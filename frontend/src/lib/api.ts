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
