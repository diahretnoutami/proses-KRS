import React, { useEffect, useMemo, useState } from "react";

type StudentOpt = { id: number; nim: string; name: string; email: string };
type CourseOpt = { id: number; code: string; name: string; credits: number };

type EnrollmentStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

type InitialData = {
  id: number;
  student_id: number;
  course_id: number;
  
  student_nim?: string;
  student_name?: string;
  student_email?: string;

  course_code?: string;
  course_name?: string;
  course_credits?: number;

  semester: 1 | 2;
  academic_year: string;
  status: EnrollmentStatus;
};

type Props = {
  mode: "create" | "update";
  enrollmentId?: number;
  initial?: InitialData;
  onClose: () => void;
  onSuccess: () => void;
};

type FieldErrors = Record<string, string>;

function isValidAcademicYear(v: string) {
  return /^\d{4}\/\d{4}$/.test(v.trim());
}
function isValidNim(v: string) {
  return /^\d{8,12}$/.test(v.trim());
}
function isValidCourseCode(v: string) {
  return /^[A-Z]{2,4}[0-9]{3}$/.test(v.trim());
}
function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function ModalShell({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 999,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: "min(920px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <div
          className="card__header"
          style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
        >
          <div>
            <h2 className="title" style={{ marginBottom: 6 }}>
              {title}
            </h2>
            {subtitle ? (
              <div style={{ color: "#6b7280", fontSize: 13 }}>{subtitle}</div>
            ) : null}
          </div>

          <button className="btn btn--ghost" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="card__body">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: "#374151" }}>{label}</label>
      {children}
      {error ? (
        <div style={{ color: "#b91c1c", fontSize: 12 }}>{error}</div>
      ) : null}
    </div>
  );
}

function SearchableSelect<T extends { id: number }>(props: {
  valueId: number | null;
  options: T[];
  getLabel: (o: T) => string;
  placeholder?: string;
  onChange: (id: number) => void;
  disabled?: boolean;
}) {
  const { valueId, options, getLabel, placeholder, onChange, disabled } = props;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const selected = valueId ? options.find((o) => o.id === valueId) : null;

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return options;
    return options.filter((o) => getLabel(o).toLowerCase().includes(qq));
  }, [q, options, getLabel]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (!open) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div style={{ position: "relative", minWidth: 280, flex: 1 }}>
      <button
        type="button"
        className="select"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span>
          {selected ? getLabel(selected) : placeholder ?? "Select..."}
        </span>
        <span style={{ color: "#6b7280" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 50,
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
          }}
        >
          <input
            className="input"
            placeholder="Search..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            disabled={disabled}
          />
          <div style={{ maxHeight: 240, overflow: "auto", marginTop: 8 }}>
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                className="btn btn--ghost"
                style={{
                  width: "100%",
                  justifyContent: "flex-start",
                  marginBottom: 6,
                }}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                  setQ("");
                }}
                disabled={disabled}
              >
                {getLabel(o)}
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: 8, color: "#6b7280" }}>No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function KrsModal({
  mode,
  enrollmentId,
  initial,
  onClose,
  onSuccess,
}: Props) {
  const isUpdate = mode === "update";

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string>("");

  const [studentMode, setStudentMode] = useState<"existing" | "new">("existing");
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [studentId, setStudentId] = useState<number | null>(null);

  const [nim, setNim] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");

  const [courseMode, setCourseMode] = useState<"existing" | "new">("existing");
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [courseId, setCourseId] = useState<number | null>(null);

  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [credits, setCredits] = useState<number>(3);

  // ===== enrolllment =====
  const [semester, setSemester] = useState<1 | 2>(1);
  const [academicYear, setAcademicYear] = useState("2025/2026");
  const [status, setStatus] = useState<EnrollmentStatus>("DRAFT");

  useEffect(() => {
    let alive = true;

    async function loadOptions() {
      try {
        const [sRes, cRes] = await Promise.all([
          fetch("/api/students"),
          fetch("/api/courses"),
        ]);

        if (!sRes.ok) throw new Error("Failed to load students");
        if (!cRes.ok) throw new Error("Failed to load courses");

        const sJson = (await sRes.json()) as
          | StudentOpt[]
          | { data: StudentOpt[] };
        const cJson = (await cRes.json()) as
          | CourseOpt[]
          | { data: CourseOpt[] };

        const sList = Array.isArray(sJson) ? sJson : sJson.data;
        const cList = Array.isArray(cJson) ? cJson : cJson.data;

        if (!alive) return;
        setStudents(sList);
        setCourses(cList);
      } catch (e: any) {
        if (!alive) return;
        setApiError(e?.message ?? "Failed to load dropdown data");
      }
    }

    loadOptions();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!isUpdate || !initial) return;

    // student locked: existing only
    setStudentMode("existing");
    setStudentId(initial.student_id);
    setNim(initial.student_nim ?? "");
    setStudentName(initial.student_name ?? "");
    setStudentEmail(initial.student_email ?? "");

    // course: existing only tapi boleh ganti dropdown
    setCourseMode("existing");
    setCourseId(initial.course_id);
    setCourseCode(initial.course_code ?? "");
    setCourseName(initial.course_name ?? "");
    setCredits(initial.course_credits ?? 3);

    setSemester(initial.semester);
    setAcademicYear(initial.academic_year);
    setStatus(initial.status);
  }, [isUpdate, initial]);

  // autofill student when existing selected
  useEffect(() => {
    if (studentMode !== "existing") return;
    if (!studentId) return;
    const s = students.find((x) => x.id === studentId);
    if (!s) return;

    setNim(s.nim);
    setStudentName(s.name);
    setStudentEmail(s.email);
  }, [studentMode, studentId, students]);

  // autofill cours when existing selected
  useEffect(() => {
    if (courseMode !== "existing") return;
    if (!courseId) return;
    const c = courses.find((x) => x.id === courseId);
    if (!c) return;

    setCourseCode(c.code);
    setCourseName(c.name);
    setCredits(c.credits);
  }, [courseMode, courseId, courses]);

  useEffect(() => {
    if (!isUpdate) return;
    if (studentMode !== "existing") setStudentMode("existing");
    if (courseMode !== "existing") setCourseMode("existing");
  }, [isUpdate, studentMode, courseMode]);

  function validateFrontend(): boolean {
    const e: FieldErrors = {};

    if (studentMode === "existing") {
      if (!studentId) e["studentId"] = "Pilih NIM dulu.";
    } else {
      if (!isValidNim(nim)) e["nim"] = "NIM wajib 8–12 digit angka, tanpa spasi.";
      if (studentName.trim().length < 3 || studentName.trim().length > 100)
        e["studentName"] = "Nama wajib 3–100 karakter.";
      if (!isValidEmail(studentEmail)) e["studentEmail"] = "Email tidak valid.";
    }

    if (courseMode === "existing") {
      if (!courseId) e["courseId"] = "Pilih Kode MK dulu.";
    } else {
      if (!isValidCourseCode(courseCode))
        e["courseCode"] = "Format code wajib [A-Z]{2,4}[0-9]{3}, contoh IF101.";
      if (courseName.trim().length < 3 || courseName.trim().length > 120)
        e["courseName"] = "Nama MK wajib 3–120 karakter.";
      if (!Number.isInteger(credits) || credits < 1 || credits > 6)
        e["credits"] = "SKS wajib integer 1–6.";
    }

    if (!isValidAcademicYear(academicYear))
      e["academicYear"] = "Tahun ajaran wajib format YYYY/YYYY (contoh 2025/2026).";

    if (![1, 2].includes(semester)) e["semester"] = "Semester harus 1 atau 2.";

    if (!["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"].includes(status))
      e["status"] = "Status tidak valid.";

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit() {
    setApiError("");
    if (!validateFrontend()) return;

    const payload: any = {
      student:
        studentMode === "existing"
          ? { mode: "existing", id: studentId }
          : {
              mode: "new",
              nim: nim.trim(),
              name: studentName.trim(),
              email: studentEmail.trim(),
            },

      course:
        courseMode === "existing"
          ? { mode: "existing", id: courseId }
          : {
              mode: "new",
              code: courseCode.trim(),
              name: courseName.trim(),
              credits: Number(credits),
            },

      enrollment: {
        academic_year: academicYear.trim(),
        semester,
        status,
      },
    };

    const url =
      isUpdate && (enrollmentId ?? initial?.id)
        ? `/api/enrollments/${enrollmentId ?? initial?.id}`
        : "/api/enrollments";
    const method = isUpdate ? "PUT" : "POST";

    try {
      setLoading(true);
      setErrors({});

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 422) {
        const j = await res.json().catch(() => null);

        if (j && j.errors && typeof j.errors === "object") {
          const fe: FieldErrors = {};
          for (const k of Object.keys(j.errors)) {
            const msg = Array.isArray(j.errors[k]) ? j.errors[k][0] : String(j.errors[k]);
            fe[k] = msg;
          }
          setErrors((prev) => ({ ...prev, ...fe }));
          setApiError(j.message ?? "Validation failed");
          return;
        }

        setApiError((j && j.message) || "Validation failed");
        return;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }

      onSuccess();
    } catch (e: any) {
      setApiError(e?.message ?? "Failed to submit");
    } finally {
      setLoading(false);
    }
  }

  const title = isUpdate ? "Edit KRS (Enrollment)" : "Tambah KRS (Atomic)";
  const subtitle = isUpdate
    ? ""
    : "Klik (+) untuk menambah data students dan course baru";

  const studentLocked = isUpdate; 
  const courseLockedNew = isUpdate; 
  const courseDetailsLocked =
    isUpdate || courseMode === "existing"; 

  return (
    <ModalShell title={title} subtitle={subtitle} onClose={onClose}>
      {apiError ? (
        <div style={{ marginBottom: 12, color: "#b91c1c", fontSize: 13 }}>
          {apiError}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
        }}
      >
        {/* student */}
        <div style={{ gridColumn: "1 / -1", marginTop: 4, fontWeight: 700 }}>
          Student
        </div>

        <Field label="NIM" error={errors["studentId"] || errors["nim"]}>
          {studentMode === "existing" ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <SearchableSelect
                valueId={studentId}
                options={students}
                getLabel={(s) => `${s.nim} — ${s.name}`}
                placeholder="Pilih NIM..."
                onChange={(id) => {
                  setStudentId(id);
                  setErrors((p) => {
                    const n = { ...p };
                    delete n["studentId"];
                    return n;
                  });
                }}
                disabled={studentLocked}
              />

              {!studentLocked && (
                <button
                  className="btn btn--ghost"
                  type="button"
                  onClick={() => {
                    setStudentMode("new");
                    setStudentId(null);
                    setNim("");
                    setStudentName("");
                    setStudentEmail("");
                  }}
                  title="Tambah student baru"
                >
                  +
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="input"
                placeholder="8-12 digit"
                value={nim}
                onChange={(e) => setNim(e.target.value)}
              />
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => {
                  setStudentMode("existing");
                  setNim("");
                  setStudentName("");
                  setStudentEmail("");
                }}
                title="Pilih existing"
              >
                Cancel
              </button>
            </div>
          )}
        </Field>

        <Field label="Nama" error={errors["studentName"] || errors["student.name"]}>
          <input
            className="input"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            disabled={studentMode === "existing" || studentLocked}
            placeholder="Nama student"
          />
        </Field>

        <Field label="Email" error={errors["studentEmail"] || errors["student.email"]}>
          <input
            className="input"
            value={studentEmail}
            onChange={(e) => setStudentEmail(e.target.value)}
            disabled={studentMode === "existing" || studentLocked}
            placeholder="email@student.com"
          />
        </Field>

        {/* COURSE */}
        <div style={{ gridColumn: "1 / -1", marginTop: 8, fontWeight: 700 }}>
          Course
        </div>

        <Field label="Kode Mata Kuliah" error={errors["courseId"] || errors["courseCode"]}>
          {courseMode === "existing" ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <SearchableSelect
                valueId={courseId}
                options={courses}
                getLabel={(c) => `${c.code} — ${c.name}`}
                placeholder="Pilih Kode MK..."
                onChange={(id) => setCourseId(id)}
                disabled={false /* update boleh ganti course */}
              />

              {!courseLockedNew && (
                <button
                  className="btn btn--ghost"
                  type="button"
                  onClick={() => {
                    setCourseMode("new");
                    setCourseId(null);
                    setCourseCode("");
                    setCourseName("");
                    setCredits(3);
                  }}
                  title="Tambah mata kuliah baru"
                >
                  +
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="input"
                placeholder="IF101"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
              />
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => {
                  setCourseMode("existing");
                  setCourseCode("");
                  setCourseName("");
                  setCredits(3);
                }}
                title="Pilih existing"
              >
                Cancel
              </button>
            </div>
          )}
        </Field>

        <Field label="Mata Kuliah" error={errors["courseName"] || errors["course.name"]}>
          <input
            className="input"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            disabled={courseDetailsLocked}
            placeholder="Nama mata kuliah"
          />
        </Field>

        <Field label="SKS / Credits" error={errors["credits"] || errors["course.credits"]}>
          <input
            className="input"
            type="number"
            min={1}
            max={6}
            value={credits}
            onChange={(e) => setCredits(Number(e.target.value))}
            disabled={courseDetailsLocked}
          />
        </Field>

        {/* enrollment */}
        <div style={{ gridColumn: "1 / -1", marginTop: 8, fontWeight: 700 }}>
          Enrollment
        </div>

        <Field label="Semester" error={errors["semester"] || errors["enrollment.semester"]}>
          <select
            className="select"
            value={semester}
            onChange={(e) => setSemester(Number(e.target.value) as 1 | 2)}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </Field>

        <Field
          label="Tahun Ajaran"
          error={errors["academicYear"] || errors["enrollment.academic_year"]}
        >
          <input
            className="input"
            placeholder="2025/2026"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
          />
        </Field>

        <Field label="Status" error={errors["status"] || errors["enrollment.status"]}>
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as EnrollmentStatus)}
          >
            <option value="DRAFT">DRAFT</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </Field>

        <div />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <button className="btn btn--ghost" type="button" onClick={onClose} disabled={loading}>
          Cancel
        </button>
        <button className="btn btn--primary" type="button" onClick={onSubmit} disabled={loading}>
          {loading ? "Saving..." : isUpdate ? "Save Changes" : "Save KRS"}
        </button>
      </div>
    </ModalShell>
  );
}
