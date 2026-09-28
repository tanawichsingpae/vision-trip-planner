import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Trash2,
  ShieldCheck,
  RefreshCw,
  Users,
  CheckCircle2,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import {
  clearBlindEvaluationResults,
  resolveEvaluatorName,
  type EvaluationRecord,
  type ScenarioComparisonRecord,
} from "@/api/blindEvalApi";

interface ClearEvaluationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resultsData: {
    evaluations: EvaluationRecord[];
    comparisons?: ScenarioComparisonRecord[];
    total_trips: number;
  };
  onCleared: () => Promise<void> | void;
}

export default function ClearEvaluationsModal({
  open,
  onOpenChange,
  resultsData,
  onCleared,
}: ClearEvaluationsModalProps) {
  const [deleteMode, setDeleteMode] = useState<"all" | "expert">("all");
  const [selectedExpertEmail, setSelectedExpertEmail] = useState<string>("");
  const [confirmText, setConfirmText] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Extract unique evaluators with their stats
  const uniqueEvaluators = useMemo(() => {
    const map = new Map<
      string,
      { email: string; name: string; evalCount: number; compCount: number }
    >();

    resultsData.evaluations.forEach((ev) => {
      const email = (ev.expert_id || "").trim().toLowerCase();
      if (!email) return;
      const entry = map.get(email) || {
        email,
        name: resolveEvaluatorName(ev.expert_name, ev.expert_id, resultsData.evaluations),
        evalCount: 0,
        compCount: 0,
      };
      entry.evalCount += 1;
      map.set(email, entry);
    });

    resultsData.comparisons?.forEach((cmp) => {
      const email = (cmp.expert_id || "").trim().toLowerCase();
      if (!email) return;
      const entry = map.get(email) || {
        email,
        name: resolveEvaluatorName(cmp.expert_name, cmp.expert_id, resultsData.comparisons),
        evalCount: 0,
        compCount: 0,
      };
      entry.compCount += 1;
      map.set(email, entry);
    });

    return Array.from(map.values()).sort((a, b) => b.evalCount - a.evalCount);
  }, [resultsData]);

  // Set default selected expert if switching to expert mode
  React.useEffect(() => {
    if (deleteMode === "expert" && uniqueEvaluators.length > 0 && !selectedExpertEmail) {
      setSelectedExpertEmail(uniqueEvaluators[0].email);
    }
  }, [deleteMode, uniqueEvaluators, selectedExpertEmail]);

  // Reset confirmation input when modal opens/closes or mode changes
  React.useEffect(() => {
    if (!open) {
      setConfirmText("");
      setIsDeleting(false);
    }
  }, [open, deleteMode]);

  const selectedExpertObj = useMemo(() => {
    return uniqueEvaluators.find((e) => e.email === selectedExpertEmail);
  }, [uniqueEvaluators, selectedExpertEmail]);

  // Calculate numbers to delete
  const targetEvalCount =
    deleteMode === "all"
      ? resultsData.evaluations.length
      : selectedExpertObj?.evalCount || 0;

  const targetCompCount =
    deleteMode === "all"
      ? resultsData.comparisons?.length || 0
      : selectedExpertObj?.compCount || 0;

  const canConfirm =
    deleteMode === "all"
      ? confirmText.trim().toUpperCase() === "CLEAR" &&
        (targetEvalCount > 0 || targetCompCount > 0)
      : Boolean(selectedExpertEmail) && (targetEvalCount > 0 || targetCompCount > 0);

  const handleExecuteDelete = async () => {
    if (!canConfirm || isDeleting) return;

    setIsDeleting(true);
    try {
      const res = await clearBlindEvaluationResults({
        target: deleteMode,
        expertId: deleteMode === "expert" ? selectedExpertEmail : undefined,
        role: "dev",
      });

      if (deleteMode === "all") {
        toast.success(
          `ล้างข้อมูลทดสอบทั้งหมดเรียบร้อยแล้ว (ลบการประเมิน ${res.deletedEvals || targetEvalCount} รายการ, ข้อคิดเห็น ${res.deletedComps || targetCompCount} รายการ)`
        );
      } else {
        toast.success(
          `ลบการประเมินของ ${selectedExpertObj?.name || selectedExpertEmail} เรียบร้อยแล้ว`
        );
      }

      await onCleared();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการลบข้อมูลการประเมิน");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg rounded-3xl p-5 sm:p-6 gap-4">
        <DialogHeader className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-2xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <Trash2 className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                ล้างข้อมูลผลการประเมินทดสอบ (Dev Cleanup)
              </DialogTitle>
              <Badge variant="outline" className="text-[10px] text-red-600 border-red-300 dark:border-red-800">
                Dev Admin Only
              </Badge>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            ใช้สำหรับล้างผลคะแนนและคำถามเชิงคุณภาพที่เกิดจากการทดสอบระบบ ก่อนเริ่มให้ผู้เชี่ยวชาญตัวจริงทำการประเมิน
          </DialogDescription>
        </DialogHeader>

        {/* Safe Guarantee Callout */}
        <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
          <ShieldCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <span className="font-semibold">ระบบป้องกันแผนการเดินทาง:</span>{" "}
            แผนการเดินทางและโจทย์ Benchmark ทั้งหมด{" "}
            <strong>({resultsData.total_trips} แผน)</strong> จะถูกเก็บรักษาไว้อย่างปลอดภัย ไม่ถูกลบอย่างแน่นอน
          </div>
        </div>

        {/* Current Database Summary */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/50">
            <span className="text-[10px] text-muted-foreground block">ผลประเมินโมเดล</span>
            <span className="text-sm font-bold text-purple-700 dark:text-purple-300">
              {resultsData.evaluations.length} รายการ
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/50">
            <span className="text-[10px] text-muted-foreground block">คำถามเชิงคุณภาพ</span>
            <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
              {resultsData.comparisons?.length || 0} รายการ
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/50">
            <span className="text-[10px] text-muted-foreground block">ผู้ทดสอบทั้งหมด</span>
            <span className="text-sm font-bold text-sky-700 dark:text-sky-300">
              {uniqueEvaluators.length} ท่าน
            </span>
          </div>
        </div>

        {/* Deletion Mode Selector */}
        <div className="space-y-3 pt-1">
          <Label className="text-xs font-semibold text-foreground">เลือกรูปแบบการลบข้อมูล:</Label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Option 1: Clear All */}
            <div
              onClick={() => setDeleteMode("all")}
              className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                deleteMode === "all"
                  ? "bg-red-50/80 dark:bg-red-950/20 border-red-300 dark:border-red-800 shadow-2xs"
                  : "bg-background hover:bg-secondary/40 border-border/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-700 dark:text-red-400">
                  ล้างข้อมูลทั้งหมด
                </span>
                {deleteMode === "all" && <CheckCircle2 className="size-3.5 text-red-600" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                ลบผลประเมินและ Feedback ของทุกคน พร้อมรีเซ็ตตัวนับผู้ประเมินใหม่
              </p>
            </div>

            {/* Option 2: Clear by Evaluator */}
            <div
              onClick={() => setDeleteMode("expert")}
              className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                deleteMode === "expert"
                  ? "bg-purple-50/80 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800 shadow-2xs"
                  : "bg-background hover:bg-secondary/40 border-border/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-400">
                  ลบเฉพาะรายบุคคล
                </span>
                {deleteMode === "expert" && <CheckCircle2 className="size-3.5 text-purple-600" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                เลือกเฉพาะอีเมลผู้ทดสอบที่ต้องการลบ โดยไม่กระทบผู้ประเมินท่านอื่น
              </p>
            </div>
          </div>

          {/* Expert Selector (when mode === "expert") */}
          {deleteMode === "expert" && (
            <div className="space-y-1.5 p-3 rounded-2xl bg-secondary/30 border border-border/60">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Users className="size-3.5 text-purple-600" />
                <span>เลือกผู้ประเมินที่ต้องการลบผลทดสอบ:</span>
              </Label>
              {uniqueEvaluators.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">ยังไม่มีผู้ประเมินในระบบ</p>
              ) : (
                <Select value={selectedExpertEmail} onValueChange={setSelectedExpertEmail}>
                  <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
                    <SelectValue placeholder="เลือกผู้ประเมิน..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {uniqueEvaluators.map((e) => (
                      <SelectItem key={e.email} value={e.email} className="text-xs">
                        {e.name} ({e.email}) — ประเมิน {e.evalCount} ครั้ง, คำถาม {e.compCount} ครั้ง
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Action Impact Warning & Confirmation Input */}
          <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 space-y-2 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4 text-amber-600 shrink-0" />
              <span>สรุปผลที่จะถูกลบ:</span>
            </div>
            <p className="text-[11px] text-muted-foreground pl-6">
              {deleteMode === "all" ? (
                <>
                  ระบบจะลบผลการประเมินโมเดล <strong>{targetEvalCount} รายการ</strong> และคำถามเชิงคุณภาพ{" "}
                  <strong>{targetCompCount} รายการ</strong> ออกจากฐานข้อมูลทั้ง Supabase และ Local Backend อย่างถาวร
                </>
              ) : (
                <>
                  ระบบจะลบผลการประเมินของ{" "}
                  <strong>
                    {selectedExpertObj?.name || selectedExpertEmail || "ผู้ประเมินที่เลือก"}
                  </strong>{" "}
                  (ผลประเมินโมเดล {targetEvalCount} รายการ, คำถามเชิงคุณภาพ {targetCompCount} รายการ)
                </>
              )}
            </p>

            {deleteMode === "all" && (
              <div className="pt-2 border-t border-amber-200/50 dark:border-amber-900/30 space-y-1.5">
                <Label htmlFor="confirmClearInput" className="text-[11px] font-semibold text-foreground">
                  พิมพ์คำว่า <span className="text-red-600 font-bold">CLEAR</span> เพื่อยืนยันการล้างข้อมูลทั้งหมด:
                </Label>
                <Input
                  id="confirmClearInput"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="CLEAR"
                  className="h-8 text-xs rounded-xl bg-background border-red-300 dark:border-red-900 uppercase font-mono tracking-wider"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-1">
          <Button
            type="button"
            variant="outline"
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-full text-xs"
          >
            ยกเลิก
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm || isDeleting}
            onClick={handleExecuteDelete}
            className="h-9 rounded-full text-xs font-semibold gap-1.5 bg-red-600 hover:bg-red-700 text-white shadow-xs"
          >
            {isDeleting ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" />
                <span>กำลังลบข้อมูล...</span>
              </>
            ) : (
              <>
                <Trash2 className="size-3.5" />
                <span>
                  {deleteMode === "all"
                    ? "ยืนยันล้างข้อมูลทั้งหมด"
                    : `ยืนยันลบข้อมูลของ ${selectedExpertObj?.name || "ผู้ประเมิน"}`}
                </span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
