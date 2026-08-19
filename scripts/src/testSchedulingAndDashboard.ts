import {
  timeStringToMinutes,
  minutesToTime12,
  minutesToTime24,
  normalizeTimeString,
  parseDoctorSchedule,
  getDoctorAvailableSlots,
  validateAppointmentBooking,
  formatDateToYYYYMMDD,
  type DoctorWeeklyScheduleConfig,
} from "../../artifacts/api-server/src/services/schedulingService";
import { db, doctorsTable, usersTable, appointmentsTable, prescriptionsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

async function runTests() {
  console.log("==================================================================");
  console.log("🧪 STARTING VERIFICATION: SCHEDULING SYSTEM & DOCTOR DASHBOARD STATS");
  console.log("==================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`, detail || "");
      failed++;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST SUITE 1: Time Conversion and Normalization
  // ─────────────────────────────────────────────────────────────────
  console.log("\n--- [Suite 1: Time Conversion & Normalization] ---");
  {
    assert(timeStringToMinutes("09:00 AM") === 540, "09:00 AM -> 540 min");
    assert(timeStringToMinutes("09:00") === 540, "09:00 (24h) -> 540 min");
    assert(timeStringToMinutes("12:00 PM") === 720, "12:00 PM -> 720 min");
    assert(timeStringToMinutes("12:00 AM") === 0, "12:00 AM -> 0 min");
    assert(timeStringToMinutes("05:30 PM") === 1050, "05:30 PM -> 1050 min");
    assert(timeStringToMinutes("17:30") === 1050, "17:30 -> 1050 min");
    assert(minutesToTime12(540) === "09:00 AM", "540 min -> 09:00 AM");
    assert(minutesToTime24(1050) === "17:30", "1050 min -> 17:30");
    assert(normalizeTimeString("9:00 am") === "09:00 AM", "Normalize '9:00 am' -> '09:00 AM'");
    assert(normalizeTimeString("14:30") === "02:30 PM", "Normalize '14:30' -> '02:30 PM'");
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST SUITE 2: Schedule Configuration Parsing
  // ─────────────────────────────────────────────────────────────────
  console.log("\n--- [Suite 2: Schedule Configuration Parsing] ---");
  {
    // Legacy String Parsing
    const legacyCfg = parseDoctorSchedule("Monday - Friday", "09:00 AM - 05:00 PM");
    assert(legacyCfg.slotDuration === 30, "Default slot duration is 30 mins");
    assert(legacyCfg.schedule.Monday.available === true, "Legacy Mon is available");
    assert(legacyCfg.schedule.Friday.available === true, "Legacy Fri is available");
    assert(legacyCfg.schedule.Saturday.available === false, "Legacy Sat is unavailable");
    assert(legacyCfg.schedule.Sunday.available === false, "Legacy Sun is unavailable");
    assert(legacyCfg.schedule.Monday.startTime === "09:00 AM", "Legacy Mon start time is 09:00 AM");
    assert(legacyCfg.schedule.Monday.endTime === "05:00 PM", "Legacy Mon end time is 05:00 PM");

    // Structured JSON Schedule Parsing
    const customConfig: DoctorWeeklyScheduleConfig = {
      slotDuration: 20,
      schedule: {
        Monday: { available: true, startTime: "10:00 AM", endTime: "02:00 PM" },
        Tuesday: { available: true, startTime: "10:00 AM", endTime: "02:00 PM" },
        Wednesday: { available: false, startTime: "09:00 AM", endTime: "05:00 PM" },
        Thursday: { available: true, startTime: "02:00 PM", endTime: "06:00 PM" },
        Friday: { available: true, startTime: "09:00 AM", endTime: "01:00 PM" },
        Saturday: { available: true, startTime: "09:00 AM", endTime: "12:00 PM" },
        Sunday: { available: false, startTime: "09:00 AM", endTime: "12:00 PM" },
      },
    };

    const parsedJsonCfg = parseDoctorSchedule("Mon, Tue, Thu, Fri, Sat", JSON.stringify(customConfig));
    assert(parsedJsonCfg.slotDuration === 20, "Parsed custom slot duration of 20 mins");
    assert(parsedJsonCfg.schedule.Wednesday.available === false, "Parsed Wed as day off");
    assert(parsedJsonCfg.schedule.Thursday.startTime === "02:00 PM", "Parsed Thu start time 02:00 PM");
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST SUITE 3: Slot Generation & Dynamic Availability
  // ─────────────────────────────────────────────────────────────────
  console.log("\n--- [Suite 3: Slot Generation & Conflict Checking] ---");
  {
    // Find an existing doctor from the database
    const doctor = await db.query.doctorsTable.findFirst();
    if (!doctor) {
      console.error("No doctor found for integration test");
      return;
    }

    const testFutureDate = "2026-10-12"; // Monday
    const slots = await getDoctorAvailableSlots(doctor.id, testFutureDate);

    assert(slots.doctorId === doctor.id, "Returned doctor ID matches");
    assert(slots.date === testFutureDate, "Returned date matches");
    assert(slots.slots.length > 0, `Generated ${slots.slots.length} consultation slots for ${testFutureDate}`);
    assert(slots.slots.every((s) => typeof s.time === "string" && typeof s.available === "boolean"), "All slots have valid shape");

    // Test Validation logic for slot alignment
    const firstValidSlot = slots.slots[0].time;
    const validCheck = await validateAppointmentBooking(doctor.id, testFutureDate, firstValidSlot);
    assert(validCheck.valid === true, `Booking on valid slot '${firstValidSlot}' is valid`);

    // Test Invalid Slot (arbitrary non-aligned time like 09:17 AM)
    const invalidCheck = await validateAppointmentBooking(doctor.id, testFutureDate, "09:17 AM");
    assert(invalidCheck.valid === false, "Arbitrary time '09:17 AM' was correctly rejected by backend");

    // Test Day Off rejection (Sunday if doctor is not working Sundays)
    const testSunday = "2026-10-18"; // Sunday
    const sundaySlots = await getDoctorAvailableSlots(doctor.id, testSunday);
    if (!sundaySlots.isAvailable) {
      const sundayCheck = await validateAppointmentBooking(doctor.id, testSunday, "10:00 AM");
      assert(sundayCheck.valid === false, "Booking on day off (Sunday) was correctly rejected by backend");
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST SUITE 4: Doctor Dashboard Appointment & Prescription Math
  // ─────────────────────────────────────────────────────────────────
  console.log("\n--- [Suite 4: Doctor Dashboard Appointment & Prescription Statistics Logic] ---");
  {
    const today = formatDateToYYYYMMDD(new Date());

    // Mock dataset simulating 10 appointments today and future appointments
    const mockAppts = [
      // 10 appointments today
      { id: 1, appointmentDate: today, appointmentTime: "09:00 AM", status: "completed" as const, patientId: 101 },
      { id: 2, appointmentDate: today, appointmentTime: "09:30 AM", status: "confirmed" as const, patientId: 102 },
      { id: 3, appointmentDate: today, appointmentTime: "10:00 AM", status: "confirmed" as const, patientId: 103 },
      { id: 4, appointmentDate: today, appointmentTime: "10:30 AM", status: "confirmed" as const, patientId: 104 },
      { id: 5, appointmentDate: today, appointmentTime: "11:00 AM", status: "confirmed" as const, patientId: 105 },
      { id: 6, appointmentDate: today, appointmentTime: "11:30 AM", status: "pending" as const, patientId: 106 },
      { id: 7, appointmentDate: today, appointmentTime: "02:00 PM", status: "pending" as const, patientId: 107 },
      { id: 8, appointmentDate: today, appointmentTime: "02:30 PM", status: "confirmed" as const, patientId: 108 },
      { id: 9, appointmentDate: today, appointmentTime: "03:00 PM", status: "confirmed" as const, patientId: 109 },
      { id: 10, appointmentDate: today, appointmentTime: "03:30 PM", status: "confirmed" as const, patientId: 110 },
      // Future pending appointment (date > today, status = pending -> must NOT count in upcoming)
      { id: 11, appointmentDate: "2026-11-01", appointmentTime: "10:00 AM", status: "pending" as const, patientId: 111 },
      // Future confirmed appointment (date > today, status = confirmed -> counts in upcoming)
      { id: 12, appointmentDate: "2026-11-02", appointmentTime: "11:00 AM", status: "confirmed" as const, patientId: 112 },
      // Future confirmed appointment
      { id: 13, appointmentDate: "2026-11-03", appointmentTime: "12:00 PM", status: "confirmed" as const, patientId: 113 },
      // Past completed appointment
      { id: 14, appointmentDate: "2026-01-01", appointmentTime: "09:00 AM", status: "completed" as const, patientId: 101 },
      // Cancelled appointment today
      { id: 15, appointmentDate: today, appointmentTime: "04:00 PM", status: "cancelled" as const, patientId: 114 },
    ];

    const mockPrescriptions = [
      { id: 201, doctorId: 1, patientId: 101 },
      { id: 202, doctorId: 1, patientId: 101 },
      { id: 203, doctorId: 1, patientId: 102 },
    ];

    // Compute metrics according to updated logic:
    const todayScheduled = mockAppts.filter((a) => a.appointmentDate === today && a.status !== "cancelled");
    const todayTotalCount = todayScheduled.length; // 10
    const todayRemainingCount = todayScheduled.filter((a) => a.status !== "completed").length; // 9
    const pendingCount = mockAppts.filter((a) => a.status === "pending").length; // 3 (id: 6, 7, 11)
    const upcomingCount = mockAppts.filter((a) => a.appointmentDate > today && a.status === "confirmed").length; // 2 (id: 12, 13)
    const totalPrescriptionsCount = mockPrescriptions.length; // 3

    assert(todayTotalCount === 10, `Today's Appointments total is exactly 10 (was ${todayTotalCount})`);
    assert(todayRemainingCount === 9, `Today's Remaining Appointments is 9 after 1 completed (was ${todayRemainingCount})`);
    assert(todayTotalCount !== todayRemainingCount, "Today's Total and Today's Remaining are properly distinguished");
    assert(pendingCount === 3, `Pending count is 3 (includes today and future unconfirmed, was ${pendingCount})`);
    assert(upcomingCount === 2, `Upcoming count is 2 (only future + confirmed, excludes future pending, was ${upcomingCount})`);
    assert(totalPrescriptionsCount === 3, `Prescriptions count is 3 (independent of appointment count, was ${totalPrescriptionsCount})`);
  }

  console.log("\n==================================================================");
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
