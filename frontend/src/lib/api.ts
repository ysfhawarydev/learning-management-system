const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
).replace(/\/+$/, '');

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  token?: string;
  body?: unknown;
};

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { token, body, headers, ...requestOptions } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const payload: unknown = await response.json();

      if (
        typeof payload === 'object' &&
        payload !== null &&
        'message' in payload
      ) {
        const apiMessage = payload.message;

        if (typeof apiMessage === 'string') {
          message = apiMessage;
        } else if (
          Array.isArray(apiMessage) &&
          apiMessage.every((item) => typeof item === 'string')
        ) {
          message = apiMessage.join(', ');
        }
      }
    } catch {
      // Use the fallback message for non-JSON responses.
    }

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  user: AuthUser;
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function getCurrentUser(token: string): Promise<AuthUser> {
  return apiRequest<AuthUser>('/auth/me', {
    method: 'GET',
    token,
  });
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  departmentId: string;
  number: string;
  birth: string;
}

export interface RegisterResponse {
  message: string;
  user: {
    id: string;
    email: string;
    status: string;
    createdAt: string;
  };
}

export async function registerRequest(
  input: RegisterInput,
): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: input,
  });
}

export async function getRegistrationDepartments(): Promise<Department[]> {
  return apiRequest<Department[]>('/auth/departments');
}

export interface PendingRegistration {
  id: string;
  userId: string;
  email: string;
  departmentId: string;
  departmentName: string;
  number: string;
  firstName: string;
  lastName: string;
  birth: string;
  accountStatus: 'pending';
  submittedAt: string;
}

export async function getPendingRegistrations(
  token: string,
): Promise<PendingRegistration[]> {
  return apiRequest<PendingRegistration[]>('/students/pending-registrations', {
    method: 'GET',
    token,
  });
}

export async function approveRegistration(
  token: string,
  studentId: string,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(
    `/students/${encodeURIComponent(studentId)}/approve`,
    {
      method: 'POST',
      token,
    },
  );
}

export interface Student {
  id: string;
  userId: string;
  departmentId: string;
  departmentName: string;
  number: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  birth: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function getStudents(token: string): Promise<Student[]> {
  return apiRequest<Student[]>('/students', {
    method: 'GET',
    token,
  });
}

export type UpdateMyStudentProfileInput = {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  birth?: string;
};

export function getMyStudentProfile(token: string): Promise<Student> {
  return apiRequest<Student>('/students/me', {
    method: 'GET',
    token,
  });
}

export interface MyCourseRecord {
  enrollmentId: string;
  enrollmentStatus: string;
  enrolledAt: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  courseDescription: string | null;
  creditValue: number;
  courseOfferingId: string;
  sectionCode: string;
  semesterId: string;
  academicYear: string;
  semesterTerm: string;
  semesterStatus: string;
  semesterStartDate: string;
  semesterEndDate: string;
  instructorId: string;
  instructorFirstName: string;
  instructorLastName: string;
}

export function getMyCourses(token: string) {
  return apiRequest<MyCourseRecord[]>('/students/me/courses', {
    method: 'GET',
    token,
  });
}

export interface MyGradeRecord {
  enrollmentId: string;
  enrollmentStatus: string;
  courseOfferingId: string;
  sectionCode: string;
  courseCode: string;
  courseTitle: string;
  semesterId: string;
  academicYear: string;
  semesterTerm: string;
  assessmentId: string;
  assessmentName: string;
  assessmentType: string;
  maxScore: string;
  weight: string;
  gradeId: string | null;
  score: string | null;
  gradedAt: string | null;
}

export function getMyGrades(token: string) {
  return apiRequest<MyGradeRecord[]>('/students/me/grades', {
    method: 'GET',
    token,
  });
}

export function updateMyStudentProfile(
  token: string,
  input: UpdateMyStudentProfileInput,
): Promise<Student> {
  return apiRequest<Student>('/students/me', {
    method: 'PATCH',
    token,
    body: input,
  });
}

export interface Department {
  id: string;
  name: string;
  code: string;
}

export interface CreateStudentInput {
  email: string;
  password: string;
  departmentId: string;
  number: string;
  firstName: string;
  lastName: string;
  birth: string;
}

export async function getDepartments(token: string): Promise<Department[]> {
  return apiRequest<Department[]>('/students/departments', {
    method: 'GET',
    token,
  });
}

export async function createStudent(
  token: string,
  input: CreateStudentInput,
): Promise<Student> {
  return apiRequest<Student>('/students/with-account', {
    method: 'POST',
    token,
    body: input,
  });
}

export interface UpdateStudentInput {
  departmentId?: string;
  number?: string;
  firstName?: string;
  lastName?: string;
  birth?: string;
  status?:
    | 'applicant'
    | 'enrolled'
    | 'on_leave'
    | 'probation'
    | 'graduated'
    | 'withdrawn';
}

export async function updateStudent(
  token: string,
  id: string,
  input: UpdateStudentInput,
): Promise<Student> {
  return apiRequest<Student>(`/students/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export async function deleteStudent(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/students/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
  });
}

export interface DepartmentRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourseRecord {
  id: string;
  departmentId: string;
  code: string;
  title: string;
  description: string | null;
  creditValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentInput {
  code: string;
  name: string;
  description?: string;
}

export type UpdateDepartmentInput = Partial<CreateDepartmentInput>;

export interface CreateCourseInput {
  departmentId: string;
  code: string;
  title: string;
  description?: string;
  creditValue: number;
}

export type UpdateCourseInput = Partial<CreateCourseInput>;

export function getAcademicDepartments(token: string) {
  return apiRequest<DepartmentRecord[]>('/departments', {
    method: 'GET',
    token,
  });
}

export function createDepartment(token: string, input: CreateDepartmentInput) {
  return apiRequest<DepartmentRecord>('/departments', {
    method: 'POST',
    token,
    body: input,
  });
}

export function updateDepartment(
  token: string,
  id: string,
  input: UpdateDepartmentInput,
) {
  return apiRequest<DepartmentRecord>(
    `/departments/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      token,
      body: input,
    },
  );
}

export function deleteDepartment(token: string, id: string) {
  return apiRequest<{ message: string }>(
    `/departments/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      token,
    },
  );
}

export function getCourses(token: string) {
  return apiRequest<CourseRecord[]>('/courses', {
    method: 'GET',
    token,
  });
}

export function createCourse(token: string, input: CreateCourseInput) {
  return apiRequest<CourseRecord>('/courses', {
    method: 'POST',
    token,
    body: input,
  });
}

export function updateCourse(
  token: string,
  id: string,
  input: UpdateCourseInput,
) {
  return apiRequest<CourseRecord>(`/courses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export function deleteCourse(token: string, id: string) {
  return apiRequest<{ message: string }>(`/courses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
  });
}

export type SemesterTerm = 'spring' | 'summer' | 'fall' | 'winter';

export type SemesterStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export interface SemesterRecord {
  id: string;
  academicYear: string;
  term: SemesterTerm;
  status: SemesterStatus;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSemesterInput {
  academicYear: string;
  term: SemesterTerm;
  status?: SemesterStatus;
  startDate: string;
  endDate: string;
}

export type UpdateSemesterInput = Partial<CreateSemesterInput>;

export function getSemesters(token: string) {
  return apiRequest<SemesterRecord[]>('/semesters', {
    method: 'GET',
    token,
  });
}

export function createSemester(token: string, input: CreateSemesterInput) {
  return apiRequest<SemesterRecord>('/semesters', {
    method: 'POST',
    token,
    body: input,
  });
}

export function updateSemester(
  token: string,
  id: string,
  input: UpdateSemesterInput,
) {
  return apiRequest<SemesterRecord>(`/semesters/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export function deleteSemester(token: string, id: string) {
  return apiRequest<{ message: string }>(
    `/semesters/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      token,
    },
  );
}

export interface InstructorRecord {
  id: string;
  userId: string;
  departmentId: string;
  departmentName: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourseOfferingRecord {
  id: string;
  courseId: string;
  semesterId: string;
  instructorId: string;
  sectionCode: string;
  capacity: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCourseOfferingInput {
  courseId: string;
  semesterId: string;
  instructorId: string;
  sectionCode: string;
  capacity?: number;
}

export type UpdateCourseOfferingInput = Partial<CreateCourseOfferingInput>;

export function getInstructors(token: string) {
  return apiRequest<InstructorRecord[]>('/instructors', {
    method: 'GET',
    token,
  });
}

export interface CreateInstructorAccountInput {
  email: string;
  password: string;
  departmentId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface UpdateInstructorInput {
  departmentId?: string;
  employeeNumber?: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
}

export function createInstructorAccount(
  token: string,
  input: CreateInstructorAccountInput,
) {
  return apiRequest<InstructorRecord>('/instructors/accounts', {
    method: 'POST',
    token,
    body: input,
  });
}

export function updateInstructor(
  token: string,
  id: string,
  input: UpdateInstructorInput,
) {
  return apiRequest<InstructorRecord>(
    `/instructors/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      token,
      body: input,
    },
  );
}

export function deleteInstructor(token: string, id: string) {
  return apiRequest<{ message: string }>(
    `/instructors/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      token,
    },
  );
}

export function getCourseOfferings(token: string) {
  return apiRequest<CourseOfferingRecord[]>('/course-offerings', {
    method: 'GET',
    token,
  });
}

export function createCourseOffering(
  token: string,
  input: CreateCourseOfferingInput,
) {
  return apiRequest<CourseOfferingRecord>('/course-offerings', {
    method: 'POST',
    token,
    body: input,
  });
}

export function updateCourseOffering(
  token: string,
  id: string,
  input: UpdateCourseOfferingInput,
) {
  return apiRequest<CourseOfferingRecord>(
    `/course-offerings/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      token,
      body: input,
    },
  );
}

export function deleteCourseOffering(token: string, id: string) {
  return apiRequest<{ id: string }>(
    `/course-offerings/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      token,
    },
  );
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface EnrollmentRecord {
  id: string;
  studentId: string;
  courseOfferingId: string;
  status: 'enrolled' | 'dropped' | 'completed' | 'withdrawn';
  enrolledAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  enrollmentId: string;
  sessionDate: string;
  status: AttendanceStatus;
  notes: string | null;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
  studentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  courseOfferingId: string;
  sectionCode: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  semesterId: string;
  academicYear: string;
  term: SemesterTerm;
}

/**
 * Attendance records visible to the authenticated student.
 * Unlike the admin AttendanceRecord, this response intentionally excludes notes.
 */
export interface MyAttendanceRecord {
  id: string;
  enrollmentId: string;
  sessionDate: string;
  status: AttendanceStatus;
  recordedAt: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  courseOfferingId: string;
  sectionCode: string;
  semesterId: string;
  academicYear: string;
  semesterTerm: SemesterTerm;
}

export interface CreateAttendanceInput {
  enrollmentId: string;
  sessionDate: string;
  status: AttendanceStatus;
  notes?: string | null;
}

export interface UpdateAttendanceInput {
  sessionDate?: string;
  status?: AttendanceStatus;
  notes?: string | null;
}

export function getEnrollments(token: string) {
  return apiRequest<EnrollmentRecord[]>('/enrollments', {
    method: 'GET',
    token,
  });
}

export function getAttendance(token: string) {
  return apiRequest<AttendanceRecord[]>('/attendance', {
    method: 'GET',
    token,
  });
}

/**
 * Fetches attendance records belonging only to the authenticated student.
 */
export function getMyAttendance(token: string): Promise<MyAttendanceRecord[]> {
  return apiRequest<MyAttendanceRecord[]>('/students/me/attendance', {
    method: 'GET',
    token,
  });
}

export function createAttendance(token: string, input: CreateAttendanceInput) {
  return apiRequest<{
    id: string;
    enrollmentId: string;
    sessionDate: string;
    status: AttendanceStatus;
    notes: string | null;
    recordedAt: string;
    createdAt: string;
    updatedAt: string;
  }>('/attendance', {
    method: 'POST',
    token,
    body: input,
  });
}

export function updateAttendance(
  token: string,
  id: string,
  input: UpdateAttendanceInput,
) {
  return apiRequest<{
    id: string;
    enrollmentId: string;
    sessionDate: string;
    status: AttendanceStatus;
    notes: string | null;
    recordedAt: string;
    createdAt: string;
    updatedAt: string;
  }>(`/attendance/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export function deleteAttendance(token: string, id: string) {
  return apiRequest<unknown>(`/attendance/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
  });
}

/* -------------------------------------------------------------------------- */
/* Assessments, assignments, submissions, and grading                         */
/* -------------------------------------------------------------------------- */

export type AssessmentType =
  'assignment' | 'quiz' | 'midterm' | 'final' | 'project';

export interface AssessmentRecord {
  id: string;
  courseOfferingId: string;
  name: string;
  type: AssessmentType;
  maxScore: string;
  weight: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssessmentInput {
  courseOfferingId: string;
  name: string;
  type: AssessmentType;
  maxScore: number;
  weight: number;
}

export interface AssignmentRecord {
  id: string;
  assessmentId: string;
  instructions: string;
  dueAt: string;
  allowLateSubmissions: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssignmentInput {
  assessmentId: string;
  instructions: string;
  dueAt: string;
  allowLateSubmissions: boolean;
}

export interface AssignmentDetailRecord {
  assignment: AssignmentRecord;
  assessment: AssessmentRecord;
  courseOffering: CourseOfferingRecord;
  enrollmentStatus?: EnrollmentRecord['status'];
}

export interface AssignmentSubmissionRecord {
  id: string;
  assignmentId: string;
  enrollmentId: string;
  content: string | null;
  submissionUrl: string | null;
  submittedAt: string;
  feedback: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentSubmissionWithStudent {
  submission: AssignmentSubmissionRecord;
  student: {
    id: string;
    number: string;
    firstName: string;
    lastName: string;
  };
}

export interface GradeRecord {
  id: string;
  enrollmentId: string;
  assessmentId: string;
  score: string | null;
  gradedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MyAssignmentSubmissionRecord {
  submission: AssignmentSubmissionRecord;
  grade: GradeRecord | null;
}

export interface SubmitAssignmentInput {
  content?: string;
  submissionUrl?: string;
}

export interface ReviewSubmissionInput {
  score: number;
  feedback?: string;
}

export interface ReviewSubmissionResponse {
  submission: AssignmentSubmissionRecord;
  grade: GradeRecord;
}

export function getAssessments(token: string) {
  return apiRequest<AssessmentRecord[]>('/assessments', {
    method: 'GET',
    token,
  });
}

export function getAssessment(token: string, id: string) {
  return apiRequest<AssessmentRecord>(
    `/assessments/${encodeURIComponent(id)}`,
    {
      method: 'GET',
      token,
    },
  );
}

export function createAssessment(token: string, input: CreateAssessmentInput) {
  return apiRequest<AssessmentRecord>('/assessments', {
    method: 'POST',
    token,
    body: input,
  });
}

export function getAssignments(token: string) {
  return apiRequest<AssignmentDetailRecord[]>('/assignments', {
    method: 'GET',
    token,
  });
}

export function getAssignment(token: string, id: string) {
  return apiRequest<AssignmentDetailRecord>(
    `/assignments/${encodeURIComponent(id)}`,
    {
      method: 'GET',
      token,
    },
  );
}

export function createAssignment(token: string, input: CreateAssignmentInput) {
  return apiRequest<AssignmentRecord>('/assignments', {
    method: 'POST',
    token,
    body: input,
  });
}

export function getAssignmentSubmissions(token: string, assignmentId: string) {
  return apiRequest<AssignmentSubmissionWithStudent[]>(
    `/assignments/${encodeURIComponent(assignmentId)}/submissions`,
    {
      method: 'GET',
      token,
    },
  );
}

export function reviewAssignmentSubmission(
  token: string,
  assignmentId: string,
  submissionId: string,
  input: ReviewSubmissionInput,
) {
  return apiRequest<ReviewSubmissionResponse>(
    `/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submissionId)}/review`,
    {
      method: 'POST',
      token,
      body: input,
    },
  );
}

export function getMyAssignmentSubmission(token: string, assignmentId: string) {
  return apiRequest<MyAssignmentSubmissionRecord | null>(
    `/assignments/${encodeURIComponent(assignmentId)}/my-submission`,
    {
      method: 'GET',
      token,
    },
  );
}

export function submitAssignment(
  token: string,
  assignmentId: string,
  input: SubmitAssignmentInput,
) {
  return apiRequest<AssignmentSubmissionRecord>(
    `/assignments/${encodeURIComponent(assignmentId)}/submissions`,
    {
      method: 'POST',
      token,
      body: input,
    },
  );
}
