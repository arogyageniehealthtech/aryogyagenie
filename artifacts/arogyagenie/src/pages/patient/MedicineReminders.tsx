import { useState } from "react";
import { useListMedicineReminders, useCreateMedicineReminder, useUpdateMedicineReminder, useDeleteMedicineReminder, getListMedicineRemindersQueryKey } from "@workspace/api-client-react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Pill, Trash2, Edit2, Plus, Clock, Repeat, FileText, CheckCircle2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const reminderSchema = z.object({
  medicineName: z.string().min(2, "Medicine name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z.enum(["once_daily", "twice_daily", "thrice_daily", "every_8_hours", "weekly", "as_needed"]),
  times: z.string().min(1, "Times are required (e.g. 08:00 AM, 08:00 PM)"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  instructions: z.string().optional(),
});

// ─── Skeleton Loader ─────────────────────────────────────────────────────────
function MedicineCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100/90 shadow-sm animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl skeleton-shimmer shrink-0" />
          <div className="space-y-1.5">
            <div className="h-4 skeleton-shimmer rounded w-28" />
            <div className="h-3 skeleton-shimmer rounded w-16" />
          </div>
        </div>
        <div className="h-5 w-9 skeleton-shimmer rounded-full" />
      </div>
      <div className="space-y-2 pt-2">
        <div className="flex justify-between">
          <div className="h-3 skeleton-shimmer rounded w-16" />
          <div className="h-3 skeleton-shimmer rounded w-20" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 skeleton-shimmer rounded w-12" />
          <div className="h-3 skeleton-shimmer rounded w-24" />
        </div>
      </div>
      <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
        <div className="h-8 w-8 skeleton-shimmer rounded-lg" />
        <div className="h-8 w-8 skeleton-shimmer rounded-lg" />
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export function PatientMedicineReminders() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const { data: reminders, isLoading } = useListMedicineReminders();
  const createReminder = useCreateMedicineReminder();
  const updateReminder = useUpdateMedicineReminder();
  const deleteReminder = useDeleteMedicineReminder();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof reminderSchema>>({
    resolver: zodResolver(reminderSchema),
    defaultValues: {
      medicineName: "", dosage: "", frequency: "once_daily", times: "", startDate: new Date().toISOString().split('T')[0]
    }
  });

  const onSubmit = (data: z.infer<typeof reminderSchema>) => {
    if (editingId) {
      updateReminder.mutate({ id: editingId, data }, {
        onSuccess: () => {
          setIsOpen(false);
          setEditingId(null);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListMedicineRemindersQueryKey() });
        }
      });
    } else {
      createReminder.mutate({ data }, {
        onSuccess: () => {
          setIsOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListMedicineRemindersQueryKey() });
        }
      });
    }
  };

  const handleEdit = (reminder: any) => {
    setEditingId(reminder.id);
    form.reset({
      medicineName: reminder.medicineName,
      dosage: reminder.dosage,
      frequency: reminder.frequency,
      times: reminder.times,
      startDate: reminder.startDate.split('T')[0],
      endDate: reminder.endDate ? reminder.endDate.split('T')[0] : undefined,
      instructions: reminder.instructions || ""
    });
    setIsOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this reminder?")) {
      deleteReminder.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMedicineRemindersQueryKey() });
        }
      });
    }
  };

  const toggleActive = (id: number, isActive: boolean) => {
    updateReminder.mutate({ id, data: { isActive: !isActive } }, {
      onSuccess: () => {
         queryClient.setQueryData(getListMedicineRemindersQueryKey(), (old: any) => 
           old ? old.map((r: any) => r.id === id ? { ...r, isActive: !isActive } : r) : old
         );
      }
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Medicines</h1>
            <p className="text-sm text-slate-500 mt-1">Manage your pill box and daily dose reminders.</p>
          </div>

          <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) setEditingId(null); }}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => form.reset()}
                className="gap-2 rounded-xl font-semibold shadow-sm"
                style={{
                  background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))",
                  border: "none",
                  color: "white",
                }}
              >
                <Plus className="h-4 w-4" />
                Add Medicine
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold">
                  {editingId ? "Edit Medicine Reminder" : "Add New Medicine"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="medicineName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Medicine Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Paracetamol 650, Metformin" className="rounded-xl" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="dosage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dosage</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. 1 tablet, 500mg" className="rounded-xl" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Quick Medicine Suggestions */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Suggested Options:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { name: "Paracetamol 650", dose: "1 tablet", freq: "twice_daily", times: "08:00 AM, 08:00 PM" },
                          { name: "Dolo 650", dose: "1 tablet", freq: "as_needed", times: "08:00 AM" },
                          { name: "Amoxicillin 500mg", dose: "1 capsule", freq: "thrice_daily", times: "08:00 AM, 02:00 PM, 08:00 PM" },
                          { name: "Pantoprazole 40mg", dose: "1 tablet before meal", freq: "once_daily", times: "07:30 AM" },
                          { name: "Cetirizine 10mg", dose: "1 tablet at night", freq: "once_daily", times: "09:30 PM" },
                        ].map((sug) => (
                          <button
                            key={sug.name}
                            type="button"
                            onClick={() => {
                              form.setValue("medicineName", sug.name);
                              form.setValue("dosage", sug.dose);
                              form.setValue("frequency", sug.freq as any);
                              form.setValue("times", sug.times);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200/60 text-xs font-medium transition-colors"
                          >
                            + {sug.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="frequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frequency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="once_daily">Once Daily</SelectItem>
                              <SelectItem value="twice_daily">Twice Daily</SelectItem>
                              <SelectItem value="thrice_daily">Thrice Daily</SelectItem>
                              <SelectItem value="every_8_hours">Every 8 Hours</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="as_needed">As Needed</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="times"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Times</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 08:00 AM, 08:00 PM" className="rounded-xl" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" className="rounded-xl" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date <span className="text-slate-400 font-normal">(Optional)</span></FormLabel>
                          <FormControl>
                            <Input type="date" className="rounded-xl" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="instructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instructions <span className="text-slate-400 font-normal">(Optional)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Take after meals with glass of water" className="rounded-xl" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-2 flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setIsOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createReminder.isPending || updateReminder.isPending}
                      className="rounded-xl gap-2"
                      style={{
                        background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))",
                        border: "none",
                        color: "white",
                      }}
                    >
                      {(createReminder.isPending || updateReminder.isPending) ? "Saving..." : "Save Medicine"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* ── Content Grid ──────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => <MedicineCardSkeleton key={i} />)}
          </div>
        ) : reminders?.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div 
              className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "hsl(243,75%,97%)" }}
            >
              <Pill className="h-8 w-8" style={{ color: "hsl(243,75%,59%)" }} />
            </div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">Your pill box is empty</h3>
            <p className="text-sm text-slate-500 max-w-xs mb-5">
              Add your prescribed medications to organize daily dose schedules and active reminders.
            </p>
            <Button
              onClick={() => { form.reset(); setIsOpen(true); }}
              className="rounded-xl gap-2"
              style={{
                background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))",
                border: "none",
                color: "white",
              }}
            >
              <Plus className="h-4 w-4" />
              Add First Medicine
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {reminders?.map((reminder) => {
              const isActive = reminder.isActive;
              const formattedFreq = reminder.frequency
                ? reminder.frequency.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
                : "";

              return (
                <div 
                  key={reminder.id} 
                  className={`bg-white rounded-2xl border shadow-sm flex flex-col justify-between overflow-hidden transition-all duration-180 ${
                    isActive 
                      ? "border-slate-100/90 hover:shadow-md" 
                      : "border-slate-200/70 bg-slate-50/60 opacity-70"
                  }`}
                >
                  <div>
                    {/* Top Accent Line */}
                    <div 
                      className="h-1.5 w-full"
                      style={{
                        background: isActive 
                          ? "linear-gradient(90deg, hsl(158,60%,42%), hsl(243,75%,59%))" 
                          : "hsl(214,32%,85%)",
                      }}
                    />

                    <div className="p-5 space-y-4">
                      {/* Header row: Icon, Name, Dosage, Switch */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div 
                            className="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                            style={{
                              background: isActive 
                                ? "linear-gradient(135deg, hsl(158,60%,42%), hsl(158,50%,34%))" 
                                : "hsl(214,32%,75%)",
                            }}
                          >
                            <Pill className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm leading-snug">{reminder.medicineName}</h3>
                            <span 
                              className="inline-block text-xs font-semibold px-2 py-0.5 rounded-md mt-0.5"
                              style={{
                                background: isActive ? "rgba(16,185,129,0.1)" : "rgba(100,116,139,0.1)",
                                color: isActive ? "#059669" : "#64748b",
                              }}
                            >
                              {reminder.dosage}
                            </span>
                          </div>
                        </div>

                        {/* Switch toggle */}
                        <Switch 
                          checked={reminder.isActive} 
                          onCheckedChange={() => toggleActive(reminder.id, reminder.isActive)} 
                        />
                      </div>

                      {/* Detail Rows */}
                      <div className="space-y-2 pt-1 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Repeat className="h-3.5 w-3.5" />
                            Frequency
                          </span>
                          <span className="font-semibold text-slate-800">{formattedFreq}</span>
                        </div>

                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Clock className="h-3.5 w-3.5" />
                            Times
                          </span>
                          <span 
                            className="font-semibold px-2 py-0.5 rounded-md text-[11px]"
                            style={{ background: "hsl(243,75%,96%)", color: "hsl(243,75%,50%)" }}
                          >
                            {reminder.times}
                          </span>
                        </div>

                        {reminder.instructions && (
                          <div className="pt-2 border-t border-slate-100 text-slate-600">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                              Instructions
                            </span>
                            <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                              {reminder.instructions}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="px-5 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleEdit(reminder)}
                      className="h-8 px-2.5 text-xs text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg gap-1.5"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDelete(reminder.id)}
                      className="h-8 px-2.5 text-xs text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
