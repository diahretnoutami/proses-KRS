import { useEffect, useMemo, useState } from "react";
import "./App.css";
import KrsModal from "./Components/KrsModal";

type EnrollmentRow = {
  id: number;
  student_id: number;
  course_id: number;
  student_nim: string;
  student_email: string;
  student_name: string;
  course_code: string;
  course_name: string;
  course_credits: number;
  semester: number;
  academic_year: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
};

type ToastType = "success" | "error";

function makeId() {
  return Math.random().toString(36).slice(2);
}

type ApiResponse = {
  data: EnrollmentRow[];
  meta: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

type SortRule = {
  field:
    | "id"
    | "student_nim"
    | "student_name"
    | "course_code"
    | "course_name"
    | "semester"
    | "academic_year"
    | "status";
  dir: "asc" | "desc";
};

const sortFieldOptions: { value: SortRule["field"]; label: string }[] = [
  { value: "academic_year", label: "academic_year" },
  { value: "semester", label: "semester" },
  { value: "student_nim", label: "student_nim" },
  { value: "student_name", label: "student_name" },
  { value: "course_code", label: "course_code" },
  { value: "course_name", label: "course_name" },
  { value: "status", label: "status" },
  { value: "id", label: "id" },
];

function Badge({ status }: { status: EnrollmentRow["status"] }) {
  const cls =
    status === "APPROVED"
      ? "badge badge--approved"
      : status === "REJECTED"
        ? "badge badge--rejected"
        : status === "SUBMITTED"
          ? "badge badge--submitted"
          : "badge badge--draft";

  return <span className={cls}>{status}</span>;
}

export default function App() {
  async function onDelete(id: number) {
    const ok = confirm("Yakin mau delete data ini?");
    if (!ok) return;

    try {
      const res = await fetch(`/api/enrollments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setPage(1); // sekarang aman karena scope-nya sama
    } catch (e) {
      console.error(e);
      alert("Delete gagal. Cek console / backend route.");
    }
  }

  const [toast, setToast] = useState<null | {
    id: string;
    type: ToastType;
    message: string;
  }>(null);

  function showToast(type: ToastType, message: string) {
    const id = makeId();
    setToast({ id, type, message });
    window.setTimeout(() => {
      setToast((t) => (t?.id === id ? null : t));
    }, 3000);
  }
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [meta, setMeta] = useState<ApiResponse["meta"] | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<EnrollmentRow | undefined>(
    undefined,
  );

  const [showCreate, setShowCreate] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [sortBy, setSortBy] = useState<
    | "id"
    | "student_nim"
    | "student_name"
    | "course_code"
    | "course_name"
    | "semester"
    | "academic_year"
    | "status"
  >("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Advanced Order (multi-column)
  const [sortRules, setSortRules] = useState<SortRule[] | null>(null);
  const [showAdvancedSort, setShowAdvancedSort] = useState(false);

  // Quick filter (min 2)
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"
  >("ALL");
  const [semesterFilter, setSemesterFilter] = useState<"ALL" | "1" | "2">(
    "ALL",
  );
  const [academicYearFilter, setAcademicYearFilter] = useState<"ALL" | string>(
    "ALL",
  );

  // live search
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // advanced filter
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filterLogic, setFilterLogic] = useState<"AND" | "OR">("AND");
  const [afNimOp, setAfNimOp] = useState<"contains" | "startsWith" | "equals">(
    "contains",
  );
  const [afNim, setAfNim] = useState("");
  const [afYearMode, setAfYearMode] = useState<"equals" | "between">("equals");
  const [afYear, setAfYear] = useState("");
  const [afYearFrom, setAfYearFrom] = useState("");
  const [afYearTo, setAfYearTo] = useState("");
  const [afSemester, setAfSemester] = useState<{ 1: boolean; 2: boolean }>({
    1: false,
    2: false,
  });
  const [afStatus, setAfStatus] = useState<{
    DRAFT: boolean;
    SUBMITTED: boolean;
    APPROVED: boolean;
    REJECTED: boolean;
  }>({ DRAFT: false, SUBMITTED: false, APPROVED: false, REJECTED: false });

  function onSort(col: typeof sortBy) {
    setPage(1);
    setSortRules(null); //matikan advanced ordrr

    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

  const columns: { label: string; key: typeof sortBy }[] = [
    { label: "NIM", key: "student_nim" },
    { label: "Nama", key: "student_name" },
    { label: "Kode MK", key: "course_code" },
    { label: "Nama MK", key: "course_name" },
    { label: "Semester", key: "semester" },
    { label: "Tahun", key: "academic_year" },
    { label: "Status", key: "status" },
  ];

  function buildAdvancedFilters() {
    const rules: any[] = [];

    if (afNim.trim()) {
      rules.push({ field: "student_nim", op: afNimOp, value: afNim.trim() });
    }

    if (afYearMode === "equals" && afYear.trim()) {
      rules.push({
        field: "academic_year",
        op: "equals",
        value: afYear.trim(),
      });
    }
    if (afYearMode === "between" && afYearFrom.trim() && afYearTo.trim()) {
      rules.push({
        field: "academic_year",
        op: "between",
        value: [afYearFrom.trim(), afYearTo.trim()],
      });
    }

    const sems = [afSemester[1] ? 1 : null, afSemester[2] ? 2 : null].filter(
      Boolean,
    );
    if (sems.length) rules.push({ field: "semester", op: "in", value: sems });

    const statuses = (
      Object.keys(afStatus) as (keyof typeof afStatus)[]
    ).filter((k) => afStatus[k]);
    if (statuses.length)
      rules.push({ field: "status", op: "in", value: statuses });

    return rules;
  }

  const advancedRules = useMemo(
    () => buildAdvancedFilters(),
    [
      afNimOp,
      afNim,
      afYearMode,
      afYear,
      afYearFrom,
      afYearTo,
      afSemester,
      afStatus,
      filterLogic,
    ],
  );

  function buildQueryParams(opts: { includePagination: boolean }) {
    const qs = new URLSearchParams({
      status: statusFilter,
      semester: semesterFilter,
      academic_year: academicYearFilter,
      search,
      filter_logic: filterLogic,
    });

    if (opts.includePagination) {
      qs.set("page", String(page));
      qs.set("page_size", String(pageSize));
    }

    if (sortRules && sortRules.length > 0) {
      qs.set("sorts", JSON.stringify(sortRules));
    } else {
      qs.set("sort_by", sortBy);
      qs.set("sort_dir", sortDir);
    }

    if (advancedRules.length > 0) {
      qs.set("filters", JSON.stringify(advancedRules));
    }

    return qs;
  }

  function onExport() {
    const qs = buildQueryParams({ includePagination: false });
    window.open(`/api/enrollments/export?${qs.toString()}`, "_blank");
  }

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // fetch data
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      const qs = buildQueryParams({ includePagination: true });

      const res = await fetch(`/api/enrollments?${qs.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ApiResponse = await res.json();
      setRows(json.data);
      setMeta(json.meta);
    }

    load().catch((e) => {
      if (e.name !== "AbortError") console.error(e);
    });

    return () => controller.abort();
  }, [
    page,
    pageSize,
    statusFilter,
    semesterFilter,
    academicYearFilter,
    search,
    filterLogic,
    sortBy,
    sortDir,
    sortRules,
    advancedRules,
  ]);

  return (
    <div className="page">
      {toast && (
        <div
          className={`toast toast--${toast.type}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}

      {}
      {showCreate && (
        <KrsModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            setPage(1);
            showToast("success", "Berhasil membuat KRS!");
          }}
        />
      )}

      {editingId !== null && (
        <KrsModal
          mode="update"
          enrollmentId={editingId}
          initial={
            editingRow && {
              id: editingRow.id,
              student_id: editingRow.student_id,
              course_id: editingRow.course_id,
              semester: editingRow.semester as 1 | 2,
              academic_year: editingRow.academic_year,
              status: editingRow.status,
              student_nim: editingRow.student_nim,
              student_name: editingRow.student_name,
              student_email: editingRow.student_email,
              course_code: editingRow.course_code,
              course_name: editingRow.course_name,
              course_credits: editingRow.course_credits,
            }
          }
          onClose={() => {
            setEditingId(null);
            setEditingRow(undefined);
          }}
          onSuccess={() => {
            setEditingId(null);
            setEditingRow(undefined);
            setPage(1);
            showToast("success", "Berhasil update KRS!");
          }}
        />
      )}

      <header className="navbar">
        <div className="navbar__inner">
          <div className="brand">
            <div className="brand__logo" />
            <b className="brand__title">KRS Akademik</b>
          </div>

          <nav className="nav">
            <a className="nav__link" href="#">
              Home
            </a>
            <a className="nav__link" href="#">
              About
            </a>
            <a className="nav__link" href="#">
              Contact
            </a>
            <a className="nav__link nav__link--primary" href="#">
              Login
            </a>
          </nav>
        </div>
      </header>

      <main className="container">
        <div className="card">
          <div className="card__header">
            <h2 className="title">Data KRS (Enrollments)</h2>
            <div className="subtitle">
              Total data: <b className="subtitle__strong">{meta?.total ?? 0}</b>
            </div>
          </div>

          <div className="card__body">
            <div className="controls">
              {/* row1 */}
              <div className="controls__row1">
                <button
                  className="btn btn--primary"
                  onClick={() => setShowCreate(true)}
                >
                  + Tambah KRS
                </button>

                <div className="control">
                  <span>Show</span>
                  <select
                    value={pageSize}
                    className="select"
                    onChange={(e) => {
                      setPage(1);
                      setPageSize(Number(e.target.value));
                    }}
                  >
                    {[10, 25, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span>entries</span>
                </div>

                <div className="control">
                  <span>Search:</span>
                  <input
                    placeholder="NIM / Nama / Kode MK..."
                    className="input"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                </div>
              </div>

              {/* row2 */}
              <div className="controls__row2">
                <div className="control">
                  <span>Status</span>
                  <select
                    className="select"
                    value={statusFilter}
                    onChange={(e) => {
                      setPage(1);
                      setStatusFilter(e.target.value as any);
                    }}
                  >
                    <option value="ALL">All</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="SUBMITTED">SUBMITTED</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>

                <div className="control">
                  <span>Semester</span>
                  <select
                    className="select"
                    value={semesterFilter}
                    onChange={(e) => {
                      setPage(1);
                      setSemesterFilter(e.target.value as any);
                    }}
                  >
                    <option value="ALL">All</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </div>

                <div className="control">
                  <span>Tahun Ajaran</span>
                  <select
                    className="select"
                    value={academicYearFilter}
                    onChange={(e) => {
                      setPage(1);
                      setAcademicYearFilter(e.target.value);
                    }}
                  >
                    <option value="ALL">All</option>
                    <option value="2024/2025">2024/2025</option>
                    <option value="2025/2026">2025/2026</option>
                  </select>
                </div>
              </div>

              {/* row3 */}
              <div className="controls__row3">
                <button
                  className="btn btn--ghost"
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  Advanced Filter
                </button>

                <button
                  className="btn btn--ghost"
                  onClick={() => setShowAdvancedSort((v) => !v)}
                >
                  Advanced Order
                </button>

                <button className="btn btn--primary" onClick={onExport}>
                  Export CSV
                </button>
              </div>

              {/* adavnced filter */}
              {showAdvanced && (
                <div className="adv">
                  <div className="adv__group1">
                    <div className="adv__item">
                      <label className="adv__label">Logic</label>
                      <select
                        className="select"
                        value={filterLogic}
                        onChange={(e) => {
                          setPage(1);
                          setFilterLogic(e.target.value as any);
                        }}
                      >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                      </select>
                    </div>

                    <div className="adv__item">
                      <label className="adv__label">NIM</label>
                      <select
                        className="select"
                        value={afNimOp}
                        onChange={(e) => {
                          setPage(1);
                          setAfNimOp(e.target.value as any);
                        }}
                      >
                        <option value="contains">contains</option>
                        <option value="startsWith">startsWith</option>
                        <option value="equals">equals</option>
                      </select>
                    </div>

                    <div className="adv__item">
                      <label className="adv__label adv__label--ghost"></label>
                      <input
                        className="input"
                        value={afNim}
                        onChange={(e) => {
                          setPage(1);
                          setAfNim(e.target.value);
                        }}
                        placeholder="contoh: 0001"
                      />
                    </div>

                    <div className="adv__item">
                      <label className="adv__label">Academic Year</label>
                      <select
                        className="select"
                        value={afYearMode}
                        onChange={(e) => {
                          setPage(1);
                          setAfYearMode(e.target.value as any);
                        }}
                      >
                        <option value="equals">equals</option>
                        <option value="between">between</option>
                      </select>
                    </div>

                    <div className="adv__item adv__item--year">
                      <label className="adv__label adv__label--ghost"></label>

                      {afYearMode === "equals" ? (
                        <input
                          className="input"
                          placeholder="2025/2026"
                          value={afYear}
                          onChange={(e) => {
                            setPage(1);
                            setAfYear(e.target.value);
                          }}
                        />
                      ) : (
                        <div className="adv__between">
                          <input
                            className="input"
                            placeholder="from (YYYY/YYYY)"
                            value={afYearFrom}
                            onChange={(e) => {
                              setPage(1);
                              setAfYearFrom(e.target.value);
                            }}
                          />
                          <input
                            className="input"
                            placeholder="to (YYYY/YYYY)"
                            value={afYearTo}
                            onChange={(e) => {
                              setPage(1);
                              setAfYearTo(e.target.value);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="adv__group2">
                    <div className="adv__block">
                      <label className="adv__label">Semester</label>

                      <label className="adv__check">
                        <input
                          type="checkbox"
                          checked={afSemester[1]}
                          onChange={(e) => {
                            setPage(1);
                            setAfSemester((s) => ({
                              ...s,
                              1: e.target.checked,
                            }));
                          }}
                        />
                        <span>1</span>
                      </label>

                      <label className="adv__check">
                        <input
                          type="checkbox"
                          checked={afSemester[2]}
                          onChange={(e) => {
                            setPage(1);
                            setAfSemester((s) => ({
                              ...s,
                              2: e.target.checked,
                            }));
                          }}
                        />
                        <span>2</span>
                      </label>
                    </div>

                    <div className="adv__block">
                      <label className="adv__label">Status</label>

                      {(
                        ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"] as const
                      ).map((st) => (
                        <label className="adv__check" key={st}>
                          <input
                            type="checkbox"
                            checked={afStatus[st]}
                            onChange={(e) => {
                              setPage(1);
                              setAfStatus((s) => ({
                                ...s,
                                [st]: e.target.checked,
                              }));
                            }}
                          />
                          <span>{st}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="adv__actions">
                    <button
                      className="btn btn--ghost"
                      onClick={() => {
                        setPage(1);
                        setFilterLogic("AND");
                        setAfNimOp("contains");
                        setAfNim("");
                        setAfYearMode("equals");
                        setAfYear("");
                        setAfYearFrom("");
                        setAfYearTo("");
                        setAfSemester({ 1: false, 2: false });
                        setAfStatus({
                          DRAFT: false,
                          SUBMITTED: false,
                          APPROVED: false,
                          REJECTED: false,
                        });
                      }}
                    >
                      Reset Advanced
                    </button>
                  </div>
                </div>
              )}

              {/* advancde order */}
              {showAdvancedSort && (
                <div className="adv">
                  <div className="adv__group1">
                    <div className="adv__item" style={{ gridColumn: "1 / -1" }}>
                      <label className="adv__label">
                        Advanced Order (multi-column)
                      </label>
                      <div
                        style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}
                      >
                        Urutan dieksekusi dari atas ke bawah.
                      </div>
                    </div>

                    {(sortRules ?? []).map((rule, idx) => (
                      <div
                        key={idx}
                        className="adv__item"
                        style={{ gridColumn: "1 / -1" }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <span style={{ width: 22, color: "#6b7280" }}>
                            {idx + 1}.
                          </span>

                          <select
                            className="select"
                            value={rule.field}
                            onChange={(e) => {
                              setPage(1);
                              setSortBy("id");
                              setSortDir("desc");
                              setSortRules((prev) => {
                                const next = [...(prev ?? [])];
                                next[idx] = {
                                  ...next[idx],
                                  field: e.target.value as any,
                                };
                                return next;
                              });
                            }}
                          >
                            {sortFieldOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>

                          <select
                            className="select"
                            value={rule.dir}
                            onChange={(e) => {
                              setPage(1);
                              setSortRules((prev) => {
                                const next = [...(prev ?? [])];
                                next[idx] = {
                                  ...next[idx],
                                  dir: e.target.value as any,
                                };
                                return next;
                              });
                            }}
                          >
                            <option value="asc">ASC</option>
                            <option value="desc">DESC</option>
                          </select>

                          <button
                            className="btn btn--ghost"
                            onClick={() => {
                              setPage(1);
                              setSortRules((prev) => {
                                const next = [...(prev ?? [])];
                                next.splice(idx, 1);
                                return next.length ? next : null;
                              });
                            }}
                            title="Remove rule"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="adv__actions" style={{ gap: 10 }}>
                    <button
                      className="btn btn--primary"
                      onClick={() => {
                        setPage(1);
                        if (!sortRules || sortRules.length === 0) {
                          setSortRules([
                            { field: "academic_year", dir: "desc" },
                            { field: "semester", dir: "asc" },
                            { field: "student_nim", dir: "asc" },
                          ]);
                          return;
                        }
                        setSortRules([...sortRules]);
                      }}
                    >
                      Apply Advanced Order
                    </button>

                    <button
                      className="btn btn--ghost"
                      onClick={() => {
                        setPage(1);
                        setSortRules((prev) => {
                          const next = [...(prev ?? [])];
                          next.push({ field: "student_nim", dir: "asc" });
                          return next;
                        });
                      }}
                    >
                      + Add Rule
                    </button>

                    <button
                      className="btn btn--ghost"
                      onClick={() => {
                        setPage(1);
                        setSortRules(null);
                        setShowAdvancedSort(false);
                      }}
                    >
                      Use Header Sort
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    {columns.map((c) => {
                      const active = sortBy === c.key;
                      const indicator = active
                        ? sortDir === "asc"
                          ? " ▲"
                          : " ▼"
                        : "";
                      return (
                        <th
                          key={c.key}
                          onClick={() => onSort(c.key)}
                          title="Click to sort"
                        >
                          {c.label}
                          {indicator}
                        </th>
                      );
                    })}

                    <th style={{ width: 160 }}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.student_nim}</td>
                      <td>{r.student_name}</td>
                      <td>{r.course_code}</td>
                      <td>{r.course_name}</td>
                      <td>{r.semester}</td>
                      <td>{r.academic_year}</td>
                      <td>
                        <Badge status={r.status} />
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            className="btn btn--ghost"
                            type="button"
                            onClick={() => {
                              setEditingId(r.id);
                              setEditingRow(r);
                            }}
                          >
                            Edit
                          </button>

                          <button
                            className="btn btn--ghost"
                            type="button"
                            onClick={() => onDelete(r.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="empty">
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn btn--ghost"
              >
                Prev
              </button>

              <span className="pagination__text">
                Page <b>{meta?.page ?? page}</b> /{" "}
                <b>{meta?.total_pages ?? 1}</b>
              </span>

              <button
                onClick={() =>
                  setPage((p) =>
                    meta ? Math.min(meta.total_pages, p + 1) : p + 1,
                  )
                }
                disabled={meta ? page >= meta.total_pages : false}
                className="btn btn--ghost"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
