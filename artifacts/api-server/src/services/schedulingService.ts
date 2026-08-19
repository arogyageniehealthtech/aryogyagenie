import { db, appointmentsTable, doctorsTable } from "@workspace/db";
import { eq, and, ne, inArray } from "drizzle-orm";

export interface DaySchedule {
  available: boolean;
  startTime: string; // e.g. "09:00 AM" or "09:00"
  endTime: string;   // e.g. "05:00 PM" or "17:00"
}

export type WeekdayName = "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";

export const WEEKDAYS: WeekdayName[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export interface DoctorScheduleConfig {
  slotDuration: number; // in minutes, e.g. 30
  schedule: Record<WeekdayName, DaySchedule>;
}

export type DoctorWeeklyScheduleConfig = DoctorScheduleConfig;

export interface GeneratedSlot {
  time: string;           // e.g. "10:00 AM"
  time24: string;         // e.g. "10:00"
  available: boolean;
  reason?: "booked" | "past" | "unavailable";
}

export interface AvailableSlotsResult {
  doctorId: number;
  date: string;           // "YYYY-MM-DD"
  dayOfWeek: WeekdayName;
  isAvailable: boolean;
  slotDuration: number;
  slots: GeneratedSlot[];
}

/**
 * Parses time string like "10:00 AM", "09:30", "1:30 PM", "14:00" into minutes from midnight (0 - 1439).
 */
export function timeStringToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr || typeof timeStr !== "string") return null;
  const trimmed = timeStr.trim().toUpperCase();

  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const mins = parseInt(match12[2], 10);
    const ampm = match12[3];
    if (hours === 12) hours = ampm === "AM" ? 0 : 12;
    else if (ampm === "PM") hours += 12;
    return hours * 60 + mins;
  }

  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const mins = parseInt(match24[2], 10);
    if (hours >= 0 && hours < 24 && mins >= 0 && mins < 60) {
      return hours * 60 + mins;
    }
  }

  return null;
}

/**
 * Formats minutes from midnight into 12-hour format e.g. "10:00 AM", "01:30 PM"
 */
export function minutesToTime12(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const ampm = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  const hrStr = hours12 < 10 ? `0${hours12}` : `${hours12}`;
  return `${hrStr}:${minStr} ${ampm}`;
}

/**
 * Formats minutes from midnight into 24-hour format e.g. "10:00", "13:30"
 */
export function minutesToTime24(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  const hrStr = hours24 < 10 ? `0${hours24}` : `${hours24}`;
  return `${hrStr}:${minStr}`;
}

/**
 * Normalizes any time string into standard 12-hour "hh:mm AM/PM" format for consistent comparisons.
 */
export function normalizeTimeString(timeStr: string): string {
  const mins = timeStringToMinutes(timeStr);
  if (mins === null) return timeStr.trim();
  return minutesToTime12(mins);
}

/**
 * Default standard schedule if doctor has not yet customized their schedule.
 * Mon-Fri: 09:00 AM - 05:00 PM, 30 min slots. Sat-Sun: OFF.
 */
export function getDefaultDoctorSchedule(): DoctorScheduleConfig {
  return {
    slotDuration: 30,
    schedule: {
      Monday: { available: true, startTime: "09:00 AM", endTime: "05:00 PM" },
      Tuesday: { available: true, startTime: "09:00 AM", endTime: "05:00 PM" },
      Wednesday: { available: true, startTime: "09:00 AM", endTime: "05:00 PM" },
      Thursday: { available: true, startTime: "09:00 AM", endTime: "05:00 PM" },
      Friday: { available: true, startTime: "09:00 AM", endTime: "05:00 PM" },
      Saturday: { available: false, startTime: "09:00 AM", endTime: "01:00 PM" },
      Sunday: { available: false, startTime: "09:00 AM", endTime: "01:00 PM" },
    },
  };
}

/**
 * Parses doctor availability from database fields (`availableDays`, `availableHours`).
 * Supports structured JSON string as well as legacy text formats ("Monday - Friday", "09:00 AM - 05:00 PM").
 */
export function parseDoctorSchedule(
  availableDays: string | null | undefined,
  availableHours: string | null | undefined
): DoctorScheduleConfig {
  const defaultConfig = getDefaultDoctorSchedule();

  // 1. Try parsing structured JSON in availableHours or availableDays
  if (availableHours && (availableHours.startsWith("{") || availableHours.startsWith("["))) {
    try {
      const parsed = JSON.parse(availableHours);
      if (parsed.schedule) {
        return {
          slotDuration: parsed.slotDuration && typeof parsed.slotDuration === "number" ? parsed.slotDuration : 30,
          schedule: {
            ...defaultConfig.schedule,
            ...parsed.schedule,
          },
        };
      }
    } catch {
      // fallback to text parsing
    }
  }

  if (availableDays && (availableDays.startsWith("{") || availableDays.startsWith("["))) {
    try {
      const parsed = JSON.parse(availableDays);
      if (parsed.schedule) {
        return {
          slotDuration: parsed.slotDuration && typeof parsed.slotDuration === "number" ? parsed.slotDuration : 30,
          schedule: {
            ...defaultConfig.schedule,
            ...parsed.schedule,
          },
        };
      }
    } catch {
      // fallback to text parsing
    }
  }

  // 2. Parse legacy text strings
  const workingDays = new Set<WeekdayName>();
  const daysStr = (availableDays || "Monday - Friday").toLowerCase();

  if (daysStr.includes("mon") && daysStr.includes("fri") && (daysStr.includes("-") || daysStr.includes("to"))) {
    workingDays.add("Monday");
    workingDays.add("Tuesday");
    workingDays.add("Wednesday");
    workingDays.add("Thursday");
    workingDays.add("Friday");
  } else if (daysStr.includes("mon") && daysStr.includes("sat") && (daysStr.includes("-") || daysStr.includes("to"))) {
    workingDays.add("Monday");
    workingDays.add("Tuesday");
    workingDays.add("Wednesday");
    workingDays.add("Thursday");
    workingDays.add("Friday");
    workingDays.add("Saturday");
  } else if (daysStr.includes("everyday") || daysStr.includes("all days") || daysStr.includes("daily")) {
    WEEKDAYS.forEach((d) => workingDays.add(d));
  } else {
    for (const day of WEEKDAYS) {
      const short = day.slice(0, 3).toLowerCase();
      if (daysStr.includes(short)) {
        workingDays.add(day);
      }
    }
  }

  if (workingDays.size === 0) {
    // Default to Mon-Fri if nothing could be parsed
    workingDays.add("Monday");
    workingDays.add("Tuesday");
    workingDays.add("Wednesday");
    workingDays.add("Thursday");
    workingDays.add("Friday");
  }

  // Parse hours range e.g. "09:00 AM - 05:00 PM" or "10:00 - 13:00"
  let defaultStart = "09:00 AM";
  let defaultEnd = "05:00 PM";
  if (availableHours && availableHours.includes("-")) {
    const [startPart, endPart] = availableHours.split("-").map((s) => s.trim());
    if (startPart && timeStringToMinutes(startPart) !== null) {
      defaultStart = normalizeTimeString(startPart);
    }
    if (endPart && timeStringToMinutes(endPart) !== null) {
      defaultEnd = normalizeTimeString(endPart);
    }
  }

  const scheduleRecord = {} as Record<WeekdayName, DaySchedule>;
  for (const day of WEEKDAYS) {
    const isAvail = workingDays.has(day);
    scheduleRecord[day] = {
      available: isAvail,
      startTime: defaultStart,
      endTime: defaultEnd,
    };
  }

  return {
    slotDuration: 30,
    schedule: scheduleRecord,
  };
}

/**
 * Gets day of week name for a YYYY-MM-DD date string in a safe, timezone-independent manner.
 */
export function getDayOfWeekFromDateStr(dateStr: string): WeekdayName {
  const [year, month, day] = dateStr.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayIndex = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ...
  return WEEKDAYS[dayIndex];
}

/**
 * Formats a Date object as YYYY-MM-DD in local time
 */
export function formatDateToYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calculates a YYYY-MM-DD date string N days before the given reference date (defaults to today).
 */
export function getDateNDaysAgo(days: number, fromDate: Date = new Date()): string {
  const d = new Date(fromDate);
  d.setDate(d.getDate() - days);
  return formatDateToYYYYMMDD(d);
}

/**
 * Generates all time slots for a doctor on a specific date, cross-referencing with existing bookings.
 */
export async function getDoctorAvailableSlots(
  doctorId: number,
  dateStr: string
): Promise<AvailableSlotsResult> {
  const doctor = await db.query.doctorsTable.findFirst({
    where: eq(doctorsTable.id, doctorId),
  });

  if (!doctor) {
    throw new Error(`Doctor with ID ${doctorId} not found`);
  }

  const scheduleConfig = parseDoctorSchedule(doctor.availableDays, doctor.availableHours);
  const dayOfWeek = getDayOfWeekFromDateStr(dateStr);
  const daySchedule = scheduleConfig.schedule[dayOfWeek];

  if (!daySchedule || !daySchedule.available) {
    return {
      doctorId,
      date: dateStr,
      dayOfWeek,
      isAvailable: false,
      slotDuration: scheduleConfig.slotDuration,
      slots: [],
    };
  }

  const startMinutes = timeStringToMinutes(daySchedule.startTime);
  const endMinutes = timeStringToMinutes(daySchedule.endTime);

  if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
    return {
      doctorId,
      date: dateStr,
      dayOfWeek,
      isAvailable: false,
      slotDuration: scheduleConfig.slotDuration,
      slots: [],
    };
  }

  const slotDuration = scheduleConfig.slotDuration || 30;

  // Query existing active appointments for this doctor on this date
  // Active means pending, confirmed, or completed (cancelled slots are freed)
  const existingAppts = await db
    .select({
      id: appointmentsTable.id,
      appointmentTime: appointmentsTable.appointmentTime,
      status: appointmentsTable.status,
    })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.doctorId, doctorId),
        eq(appointmentsTable.appointmentDate, dateStr),
        inArray(appointmentsTable.status, ["pending", "confirmed", "completed"])
      )
    );

  const bookedMinutesSet = new Set<number>();
  for (const appt of existingAppts) {
    const mins = timeStringToMinutes(appt.appointmentTime);
    if (mins !== null) {
      bookedMinutesSet.add(mins);
    }
  }

  // Determine if dateStr is today to filter out passed times
  const todayStr = formatDateToYYYYMMDD(new Date());
  const isToday = dateStr === todayStr;
  const now = new Date();
  const currentMinutesToday = now.getHours() * 60 + now.getMinutes();

  const slots: GeneratedSlot[] = [];

  for (let m = startMinutes; m + slotDuration <= endMinutes; m += slotDuration) {
    const time12 = minutesToTime12(m);
    const time24 = minutesToTime24(m);

    let isSlotAvailable = true;
    let reason: "booked" | "past" | "unavailable" | undefined = undefined;

    if (bookedMinutesSet.has(m)) {
      isSlotAvailable = false;
      reason = "booked";
    } else if (isToday && m <= currentMinutesToday + 5) {
      // Past time or buffer
      isSlotAvailable = false;
      reason = "past";
    }

    slots.push({
      time: time12,
      time24,
      available: isSlotAvailable,
      reason,
    });
  }

  return {
    doctorId,
    date: dateStr,
    dayOfWeek,
    isAvailable: true,
    slotDuration,
    slots,
  };
}

/**
 * Validates whether a patient's requested appointment date & time is valid for a doctor.
 */
export async function validateAppointmentBooking(
  doctorId: number,
  dateStr: string,
  timeStr: string
): Promise<{ valid: boolean; error?: string; normalizedTime?: string }> {
  // 1. Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { valid: false, error: "Invalid date format. Expected YYYY-MM-DD" };
  }

  // 2. Check if date is in the past
  const todayStr = formatDateToYYYYMMDD(new Date());
  if (dateStr < todayStr) {
    return { valid: false, error: "Cannot book an appointment for a past date." };
  }

  // 3. Generate slots for this doctor on that date
  const slotResult = await getDoctorAvailableSlots(doctorId, dateStr);

  if (!slotResult.isAvailable || slotResult.slots.length === 0) {
    return {
      valid: false,
      error: `Doctor is not available for consultations on ${slotResult.dayOfWeek}. Please select another date.`,
    };
  }

  const reqMinutes = timeStringToMinutes(timeStr);
  if (reqMinutes === null) {
    return { valid: false, error: "Invalid time format provided." };
  }

  // 4. Find matching slot boundary
  const matchingSlot = slotResult.slots.find((s) => {
    const sMins = timeStringToMinutes(s.time);
    return sMins === reqMinutes;
  });

  if (!matchingSlot) {
    return {
      valid: false,
      error: `The requested time (${timeStr}) does not match any valid ${slotResult.slotDuration}-minute consultation slot for this doctor.`,
    };
  }

  if (!matchingSlot.available) {
    if (matchingSlot.reason === "booked") {
      return {
        valid: false,
        error: "Sorry, this slot is no longer available. Please select another time.",
      };
    }
    if (matchingSlot.reason === "past") {
      return {
        valid: false,
        error: "This time slot has already passed for today. Please select a future time.",
      };
    }
    return {
      valid: false,
      error: "This time slot is unavailable.",
    };
  }

  return {
    valid: true,
    normalizedTime: matchingSlot.time,
  };
}
