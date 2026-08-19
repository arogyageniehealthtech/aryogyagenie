import {
  timeStringToMinutes,
  minutesToTime12,
  minutesToTime24,
  normalizeTimeString,
  parseDoctorSchedule,
  getDoctorAvailableSlots,
  validateAppointmentBooking,
  formatDateToYYYYMMDD,
  type DoctorScheduleConfig,
} from "../../artifacts/api-server/src/services/schedulingService";
import { db, doctorsTable, usersTable, appointmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function verifyDoctorPatientSync() {
  console.log("==================================================================");
  console.log("🔍 FULL-FLOW VERIFICATION: DOCTOR AVAILABILITY -> PATIENT BOOKING");
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

  // 1. Check existing doctors & patients in database
  const allDoctors = await db.select().from(doctorsTable);
  const allUsers = await db.select().from(usersTable);
  const allAppointments = await db.select().from(appointmentsTable);

  console.log(`\n--- [Database State: ${allDoctors.length} Doctors, ${allUsers.length} Users, ${allAppointments.length} Appointments] ---`);
  assert(allDoctors.length >= 1, "At least 1 doctor exists in database");
  assert(allAppointments.length >= 1, "Existing appointment records remain intact in database");

  // 2. Test Doctor A: Configured with 30-min slots, Mon-Fri 9 AM - 5 PM
  console.log("\n--- [Test 1: Doctor A Schedule & Slot Duration (30 min)] ---");
  const docAConfig: DoctorScheduleConfig = {
    slotDuration: 30,
    schedule: {
      Monday: { available: true, startTime: "09:00 AM", endTime: "05:00 PM" },
      Tuesday: { available: true, startTime: "09:00 AM", endTime: "05:00 PM" },
      Wednesday: { available: false, startTime: "09:00 AM", endTime: "05:00 PM" }, // Wednesday OFF
      Thursday: { available: true, startTime: "09:00 AM", endTime: "05:00 PM" },
      Friday: { available: true, startTime: "09:00 AM", endTime: "05:00 PM" },
      Saturday: { available: false, startTime: "09:00 AM", endTime: "01:00 PM" },
      Sunday: { available: false, startTime: "09:00 AM", endTime: "01:00 PM" },
    },
  };

  const parsedDocA = parseDoctorSchedule("Mon, Tue, Thu, Fri", JSON.stringify(docAConfig));
  assert(parsedDocA.slotDuration === 30, "Doctor A slot duration is 30 mins");
  assert(parsedDocA.schedule.Monday.available === true, "Doctor A is available on Monday");
  assert(parsedDocA.schedule.Wednesday.available === false, "Doctor A is OFF on Wednesday");

  // 3. Test Doctor B: Configured with 15-min slots, Mon 10 AM - 1 PM, Thu 2 PM - 6 PM
  console.log("\n--- [Test 2: Doctor B Schedule & Slot Duration (15 min, Custom Hours)] ---");
  const docBConfig: DoctorScheduleConfig = {
    slotDuration: 15,
    schedule: {
      Monday: { available: true, startTime: "10:00 AM", endTime: "01:00 PM" },
      Tuesday: { available: false, startTime: "09:00 AM", endTime: "05:00 PM" },
      Wednesday: { available: false, startTime: "09:00 AM", endTime: "05:00 PM" },
      Thursday: { available: true, startTime: "02:00 PM", endTime: "06:00 PM" },
      Friday: { available: false, startTime: "09:00 AM", endTime: "05:00 PM" },
      Saturday: { available: false, startTime: "09:00 AM", endTime: "01:00 PM" },
      Sunday: { available: false, startTime: "09:00 AM", endTime: "01:00 PM" },
    },
  };

  const parsedDocB = parseDoctorSchedule("Mon, Thu", JSON.stringify(docBConfig));
  assert(parsedDocB.slotDuration === 15, "Doctor B slot duration is 15 mins");
  assert(parsedDocB.schedule.Monday.startTime === "10:00 AM", "Doctor B starts at 10:00 AM on Monday");
  assert(parsedDocB.schedule.Monday.endTime === "01:00 PM", "Doctor B ends at 01:00 PM on Monday");
  assert(parsedDocB.schedule.Thursday.startTime === "02:00 PM", "Doctor B starts at 02:00 PM on Thursday");
  assert(parsedDocB.schedule.Tuesday.available === false, "Doctor B is OFF on Tuesday");

  // 4. Test Schedule Independence (Doctor A != Doctor B)
  console.log("\n--- [Test 3: Schedule Isolation Between Doctor A & Doctor B] ---");
  assert(parsedDocA.slotDuration !== parsedDocB.slotDuration, "Doctor A (30m) and Doctor B (15m) maintain independent durations");
  assert(parsedDocA.schedule.Monday.startTime !== parsedDocB.schedule.Monday.startTime, "Doctor A (9 AM) and Doctor B (10 AM) maintain independent start times");
  assert(parsedDocA.schedule.Tuesday.available !== parsedDocB.schedule.Tuesday.available, "Doctor A (Available) and Doctor B (OFF) have independent Tuesday availability");

  // 5. Test Live Database Slot Generation for Selected Doctor
  console.log("\n--- [Test 4: Live Slot Generation & Patient POV Retrieval] ---");
  const sampleDoctor = allDoctors[0];
  if (sampleDoctor) {
    const slotsResult = await getDoctorAvailableSlots(sampleDoctor.id, "2026-10-12"); // Monday
    assert(slotsResult.doctorId === sampleDoctor.id, `Patient queries doctor ID #${sampleDoctor.id} correctly`);
    assert(slotsResult.date === "2026-10-12", "Patient queries target date correctly");
    assert(Array.isArray(slotsResult.slots), "Returns slots array for patient selector");
    assert(typeof slotsResult.slotDuration === "number", "Returns doctor's configured slot duration to patient");
  }

  // 6. Test Backend Validation & Off-Grid Rejection
  console.log("\n--- [Test 5: Backend Rejection of Invalid / Off-Grid Slot Times] ---");
  if (sampleDoctor) {
    // 10:17 AM is off-grid
    const invalidTimeCheck = await validateAppointmentBooking(sampleDoctor.id, "2026-10-12", "10:17 AM");
    assert(invalidTimeCheck.valid === false, "Backend strictly rejected off-grid time '10:17 AM'");

    // Past date check
    const pastDateCheck = await validateAppointmentBooking(sampleDoctor.id, "2020-01-01", "10:00 AM");
    assert(pastDateCheck.valid === false, "Backend strictly rejected past date '2020-01-01'");
  }

  console.log("\n==================================================================");
  console.log(`📊 FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  return { passed, failed };
}

verifyDoctorPatientSync()
  .then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
