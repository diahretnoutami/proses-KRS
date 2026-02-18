# KRS / Enrollment Single Page CRUD (Full Stack)

## Demo
- App URL: ...
- (Optional) Demo account: ...
- Export: tombol Export di halaman utama / endpoint: ...

## Tech Stack
- Frontend: Vite
- Backend: Laravel
- DB: PostgreSql

## Features
- CRUD Enrollments (KRS) + relasi Students & Courses
- Create menggunakan 1 transaksi yang melibatkan 3 tabel (students, courses, enrollments)
- Server-side pagination, sorting, quick filter, live search, advanced filter (AND/OR)
- Export seluruh data (hingga 5.000.000 rows) sesuai filter/query
- Seeder >= 5.000.000 rows

## Database 
### Schema
- students(id, nim, name, email, created_at, updated_at)
- courses(id, code, name, credits, created_at, updated_at)
- enrollments(id, student_id FK, course_id FK, academic_year, semester, status,created_at, updated_at)

### Relations (FK)
- enrollments.student_id → students.id (ON UPDATE CASCADE, ON DELETE RESTRICT)
- enrollments.course_id → courses.id (ON UPDATE CASCADE, ON DELETE RESTRICT)

### Uniqueness
- students.nim UNIQUE
- students.email UNIQUE
- courses.code UNIQUE
- enrollments UNIQUE (student_id, course_id, academic_year, semester)

### Check Constraints (DB-level validation)
- enrollments.academic_year must match YYYY/YYYY
- enrollments.semester in {1,2}
- enrollments.status in {DRAFT, SUBMITTED, APPROVED, REJECTED}

### Indexes (performa untuk 5 juta baris)
- idx_enrollments_student (student_id)
- idx_enrollments_course (course_id)
- idx_enrollments_term_status (academic_year, semester, status)

## Delete & Update
### Delete: Hard Delete (hanya enrollment)
Delete menggunakan hard delete pada tabel enrollments. Aksi ini hanya menghapus relasi KRS (enrollment) tanpa mempengaruhi master data students/courses.

### Update (hanya enrollment)
Update hanya mengubah data pada tabel enrollments. `course_id` bisa diganti (pindah mata kuliah) tetapi tidak mengubah master data course maupun student.

## Setup Local
### Prerequisites
Berikut versi yang dipakai saat development:
- PHP **8.2.30**
- Composer **2.5.8**
- Node.js **v22.14.0**
- npm **10.9.2**
- PostgreSQL **16.11**

### 1) clone repo
```bash
git clone https://github.com/diahretnoutami/prosesKRS
cd prosesKRS
```

### Backend Setup
### 2) Konfigurasi env
``` cd backend
cp .env.example .env
```

edit .env:
```
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=pcrtest
DB_USERNAME=postgres
DB_PASSWORD=yourpassword
```

### 3) Install dependencies & generate app key
``` composer install
php artisan key:generate
```

### 4) Create Database (via psql)
```psql -U postgres
CREATE DATABASE pcrtest;
\q
```

### 5) Migration
```php artisan migrate```

### 6) Seeder
```php artisan db:seed --class=StudentSeeder```
```php artisan db:seed --class=CourseSeeder```
```php -d memory_limit=2048M artisan db:seed --class=EnrollmentSeeder```

verifikasi:
```psql -U postgres -d pcrtest -c "SELECT COUNT(*) FROM enrollments;"```

### 7) Run Backend
```php artisan serve```

### Frontend setup
### 8) Install dependencies
``cd frontend
npm install``

### 9) Run frontend
```npm run dev```

## Seeder 5.000.000 Data (Enrollments)
Seeder utama untuk dataset besar:
- `EnrollmentSeeder` (default membuat 5.000.000 rows, batch insert 5.000)

Cara menjalankan ada di **Setup Local**.

### Statregi performa seeding
- Menggunakan `DB::disableQueryLog()` untuk mencegah memory bloat.
- Insert dilakukan dengan **batching** (`batchSize` default 5.000) agar tidak insert per row
- Enrollment menggunakan pola kombinasi deterministik (student x course x term) untuk menghindari duplikasi dan memenuhi unique constraint
- Progresslog tiap 200.000 row untuk monitoring proses

## Cara Pakai Aplikasi (UserFlow)
Aplikasi terdiri dari **1 halaman utama** (single page) untuk mengelola data KRS / enrollments.

### 1) Halaman Tabel Enrollments
- Saat halaman dibuka, tabel menampilkan data KRS dengan **server-side pagination**.
- Kolom minimal yang ditampilkan:
  - NIM, Nama Mahasiswa
  - Kode MK, Nama MK
  - Semester, Tahun Ajaran
  - Status
- Fitur tabel:
  - Pagination + page size (server-side)
  - Sorting per kolom (server-side)
  - Quick filter: Status dan Semester (server-side)
  - Live search (debounce) minimal pada NIM, Nama Mahasiswa, Kode MK (server-side)
  - Advanced filter untuk semua kolom (multi-filter) + dukungan AND/OR

### 2) Create Enrollment (Atomic Store)
Klik tombol **Tambah KRS**, form mendukung:
- **Student**: pilih existing (dropdown) atau tambah baru
- **Course**: pilih existing (dropdown) atau tambah baru

**Behavior saat submit (atomic transaction):**
- Jika pilih existing → gunakan `student.id` / `course.id`
- Jika tambah baru → backend melakukan upsert student (berdasarkan `nim/email`) dan upsert course (berdasarkan `code`)
- Sistem membuat record di `enrollments` dengan FK valid
- Semua proses berjalan dalam **1 transaksi database** (rollback jika salah satu ggagal)

Catatan: pada proses Create, backend menetapkan status default menjadi **SUBMITTED**.

### 3) Update Enrollment
Dari tabel, pilih salah satu enrollment lalu klik **Edit**:
- Field yang dapat diubah: `academic_year`, `semester`, `status`
- (Jika tersedia di UI) `course_id` dapat diganti untuk pindah mata kuliah, namun **tidak mengubah** data master course.

### 4) Delete Enrollment
Dari tabel, klik **Delete** pada enrollment:
- Delete bersifat **hard delete** pada tabel `enrollments`
- Data master `students` dan `courses` tidak ikut terhapus

### 5) Export
Klik tombol **Export** untuk mengekspor data:
- Export menghasilkan file (CSV) untuk **seluruh data** sesuai filter/query aktif (bukan hanya 1 halaman)
- Dapat mengekspor dataset besar (hingga 5.000.000 rows) dengan strategi aman memory (batching/streaming)


## API Specification
### 1) List Enrollments (server-side table)
**GET** `/api/enrollments`

#### Response (per row)
Contoh item:
```json
{
  "id": 5000034,
  "student_nim": "215500068",
  "student_name": "Student 68",
  "course_code": "IF179",
  "course_name": "Course IF179",
  "semester": 2,
  "academic_year": "2020/2021",
  "status": "REJECTED",
  "student_id": 68,
  "course_id": 79
}
```

#### Query Params
- Pagination: `page`, `page_size`
- Quick filter: `status` (`ALL|DRAFT|SUBMITTED|APPROVED|REJECTED`), `semester` (`ALL|1|2`), `academic_year` (`ALL|YYYY/YYYY`)
- Search: `search` (mencari minimal pada `student_nim`, `student_name`, `course_code`)
- Single sort: `sort_by`, `sort_dir` (`asc|desc`)
- Advanced filter: `filters` (JSON array, urlencoded)
- Filter logic: `filter_logic` (`AND|OR`)
- Multi sort (advanced order): `sorts` (JSON array, urlencoded)

**Example:**
/api/enrollments?status=REJECTED&semester=ALL&academic_year=ALL&search=&filter_logic=AND&page=1&page_size=10&sort_by=student_name&sort_dir=desc

**POST** `/api/enrollments`
Create enrollment (**1 transaksi**: upsert `students` + upsert `courses` + insert `enrollments`).

Request body:
```json
{
  "student": {
    "nim": "215500123",
    "name": "Nama Mahasiswa",
    "email": "mhs@example.com"
  },
  "course": {
    "code": "IF101",
    "name": "Algoritma",
    "credits": 3
  },
  "enrollment": {
    "academic_year": "2025/2026",
    "semester": 1,
    "status": "DRAFT"
  }
}
```

**PUT** `/api/enrollments{id}`
Update enrollment (mis: status, semester, academic_year, opsional course_id).

**DELETE** `/api/enrollments/{id}`
Hard delete enrollment.

**GET** `/api/enrollments/export`
Export seluruh data sesuai filter/query (bukan hanya current page).
Mekanisme: streaming/chunking (CSV).


## Implementasi Filter AND/OR
### Default
Secara default, kombinasi filter menggunakan **AND** (semua kondisi harus terpenuhi).

### AND/OR via `filter_logic`
Logika gabungan filter dikontrol melalui query param:
- `filter_logic=AND` → semua filter digabung dengan AND
- `filter_logic=OR` → filter digabung dengan OR (minimal 2 filter)

### Format Advanced Filter (`filters`)
Advanced filter dikirim melalui query param `filters` dalam bentuk **JSON array**.

Contoh (human-readable):
```json
[
  { "field": "student_nim", "op": "contains", "value": "999" },
  { "field": "academic_year", "op": "equals", "value": "2025/2026" },
  { "field": "semester", "op": "in", "value": [1] },
  { "field": "status", "op": "in", "value": ["APPROVED"] }
]
```

Contoh interpretasi query:
Misalnya jika: `filter_logic=AND` maka query sama dengan 
```
(student_nim CONTAINS "999")
AND (academic_year = "2025/2026")
AND (semester IN [1])
AND (status IN ["APPROVED"])
```
JIka `filter_logic=OR` maka query sama dengan
```(status IN ["APPROVED"]) OR (course_code CONTAINS "IF")
```

## Validasi FE BE
Validasi dilakukan di **frontend** (sebelum submit) dan di **backend** (Laravel validation). Jika lolos FE, backend tetap memvalidasi ulang untuk keamanan.

### students
**Frontend (saat mode = new):**
- `nim`: wajib, **8–12 digit angka** (`^\d{8,12}$`)
- `name`: wajib, **3–100 karakter**
- `email`: wajib, format email valid

**Backend (Laravel):**
- `student.mode`: `existing|new`
- Jika `existing`: `student.id` wajib dan `exists:students,id`
- Jika `new`:
  - `student.nim`: required, regex `^\d{8,12}$`
  - `student.name`: required, string, min 3, max 100
  - `student.email`: required, email, max 255
- Upsert rule:
  - jika NIM/email sudah ada namun tidak match pasangan yang sama → API mengembalikan 422 (`NIM atau email sudah dipakai oleh student lain.`)

### Courses
**Frontend (saat mode = new):**
- `code`: wajib, regex `^[A-Z]{2,4}[0-9]{3}$` (contoh `IF101`)
- `name`: wajib, **3–120 karakter**
- `credits`: wajib, integer **1–6**

**Backend (Laravel):**
- `course.mode`: `existing|new`
- Jika `existing`: `course.id` wajib dan `exists:courses,id`
- Jika `new`:
  - `course.code`: required, regex `^[A-Z]{2,4}[0-9]{3}$`
  - `course.name`: required, string, min 3, max 120
  - `course.credits`: required, integer, min 1, max 6
- Upsert:
  - jika course code sudah ada → data `name/credits` di-update

### Enrollments
**Frontend:**
- `academic_year`: wajib, format `YYYY/YYYY`
- `semester`: wajib, enum **1/2**
- `status`: enum `DRAFT|SUBMITTED|APPROVED|REJECTED`

**Backend (Laravel):**
- `enrollment.academic_year`: required, regex `^\d{4}\/\d{4}$`
- `enrollment.semester`: required, in `[1,2]`
- **Create:** status diset oleh backend menjadi `SUBMITTED`
- **Update:** `enrollment.status` required, in `DRAFT|SUBMITTED|APPROVED|REJECTED`
- Unique constraint:
  - tidak boleh ada duplikasi kombinasi `(student_id, course_id, academic_year, semester)`
  - jika duplikat → API mengembalikan 422:
    - Create: `KRS sudah ada untuk student+mk+tahun+semester tersebut.`
    - Update: `KRS duplikat untuk student+mk+tahun+semester tersebut.`


## Export 5.000.000 Data (Strategy)

### Format output
- Output minimal: **CSV**
- Encoding: **UTF-8** (dengan BOM agar aman dibuka di Excel)

### Endpoint
- `GET /api/enrollments/export`
- Export selalu mengikuti query/filter aktif (status/semester/academic_year/search/filters/filter_logic + sorting).

### Mekanisme
Export menggunakan **streaming response** (`streamDownload`) sehingga file dikirim bertahap tanpa menampung seluruh data di memory.

### Kenapa aman untuk 5 juta baris
Implementasi dibuat memory-safe:
- Menggunakan `cursor()` untuk iterasi row **secara streaming** (tidak load semua ke RAM).
- Menulis output per-row ke `php://output` via `fputcsv`.
- Flush berkala tiap **5.000 row** (`fflush`) untuk menjaga penggunaan memory stabil.
- `set_time_limit(0)` agar proses export tidak timeout untuk dataset besar.

### Catatan XLSX
Project ini menggunakan CSV. XLSX tidak dipakai karena ada limit baris dan overhead memory yang lebih besar. Jika perlu XLSX, strategi yang disarankan adalah split per sheet / multiple files (zip) untuk dataset besar.


## Catatan Performa & Batasan

### Index yang paling berdampak (5 juta rows)
Index berikut paling berpengaruh untuk menjaga endpoint list tetap responsif:
- `idx_enrollments_term_status (academic_year, semester, status)`  
  mempercepat quick filter (tahun ajaran/semester/status) dan kombinasi query umum
- `idx_enrollments_student (student_id)` dan `idx_enrollments_course (course_id)`  
  mempercepat join/filter berdasarkan relasi FK (student/course)
- Unique index pada master data (`students.nim`, `students.email`, `courses.code`)  
  membantu lookup/upsert dan pencarian exact/prefix pada kolom tersebut

### Estimasi waktu seed & export (faktor yang mempengaruhi)
Waktu proses seeding 5.000.000 dan export sangat tergantung pada:
- performa disk (SSD jauh lebih cepat daripada HDD)
- konfigurasi PostgreSQL, ukuran shared buffers, dan kondisi cache
- batch size insert (seeder menggunakan batching)
- load CPU dan memory saat proses berjalan

### Limitasi yang disadari
- Export 5.000.000 baris via streaming tetap stabil secara memory, namun bisa memakan waktu cukup lama dan bergantung jaringan.
- Untuk pengalaman user yang lebih baik, export dapat ditingkatkan menjadi background job (queue) + download link (belum diimplementasi pada versi ini).
- Pencarian `contains` pada kolom teks besar bisa lebih lambat pada dataset besar; optimasi lanjutan dapat menggunakan trigram index (`pg_trgm`) jika diperlukan.


## Catatan
Karena batasan resource pada Railway free tier, data produksi hanya diisi dengan data demo terbatas.
Sistem ini dirancang dan diuji secara lokal dengan 5.000.000 record.


