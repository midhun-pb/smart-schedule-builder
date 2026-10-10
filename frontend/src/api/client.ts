const API_BASE = (import.meta as any).env?.VITE_API_BASE || '/api';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('smart_sched_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorDetail = 'API Request Failed';
      try {
        const errorJson = await res.json();
        errorDetail = errorJson.detail || errorDetail;
      } catch {
        errorDetail = `HTTP ${res.status}: ${res.statusText}`;
      }
      throw new Error(errorDetail);
    }

    return res.json();
  }

  // Auth
  login = (creds: { email: string; password: string }) =>
    this.request<any>('/auth/login', { method: 'POST', body: JSON.stringify(creds) });

  switchRole = (role: 'admin' | 'manager' | 'employee', personId?: number) =>
    this.request<any>('/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ role, person_id: personId }),
    });

  getMe = () => this.request<any>('/auth/me');

  // Organizations
  getPresets = () => this.request<any[]>('/organizations/presets');
  getOrganizations = () => this.request<any[]>('/organizations');
  getOrganization = (id: number) => this.request<any>(`/organizations/${id}`);
  createOrganization = (data: any) =>
    this.request<any>('/organizations', { method: 'POST', body: JSON.stringify(data) });
  updateOrganization = (id: number, data: any) =>
    this.request<any>(`/organizations/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  getDepartments = (orgId: number) =>
    this.request<any[]>(`/organizations/${orgId}/departments`);

  // Profiles
  getPeople = (params: { org_id: number; department_id?: number; search?: string }) => {
    const query = new URLSearchParams({ org_id: String(params.org_id) });
    if (params.department_id) query.append('department_id', String(params.department_id));
    if (params.search) query.append('search', params.search);
    return this.request<any[]>(`/profiles?${query.toString()}`);
  };

  createPerson = (data: any) =>
    this.request<any>('/profiles', { method: 'POST', body: JSON.stringify(data) });

  updatePerson = (id: number, data: any) =>
    this.request<any>(`/profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) });

  deletePerson = (id: number) =>
    this.request<any>(`/profiles/${id}`, { method: 'DELETE' });

  getDataQualityStats = (orgId: number) =>
    this.request<any>(`/profiles/quality-stats?org_id=${orgId}`);

  // Data Import
  previewFile = async (orgId: number, file: File) => {
    const formData = new FormData();
    formData.append('org_id', String(orgId));
    formData.append('file', file);
    return this.request<any>('/data-import/preview', { method: 'POST', body: formData });
  };

  commitImport = (orgId: number, records: any[]) =>
    this.request<any>('/data-import/commit', {
      method: 'POST',
      body: JSON.stringify({ org_id: orgId, records }),
    });

  // Schedules
  getSchedules = (orgId: number) =>
    this.request<any[]>(`/schedules?org_id=${orgId}`);

  getScheduleDetails = (id: number) =>
    this.request<any>(`/schedules/${id}`);

  generateSchedule = (payload: {
    org_id: number;
    title: string;
    period_start: string;
    period_end: string;
    fairness_weight?: number;
    preference_weight?: number;
    overtime_penalty_weight?: number;
    regenerate_days?: number[];
    only_unassigned?: boolean;
  }) =>
    this.request<any>('/schedules/generate', { method: 'POST', body: JSON.stringify(payload) });

  createSlot = (data: any) =>
    this.request<any>('/schedules/slots', { method: 'POST', body: JSON.stringify(data) });

  updateSlot = (id: number, data: any) =>
    this.request<any>(`/schedules/slots/${id}`, { method: 'PUT', body: JSON.stringify(data) });

  deleteSlot = (id: number) =>
    this.request<any>(`/schedules/slots/${id}`, { method: 'DELETE' });

  toggleSlotLock = (id: number) =>
    this.request<any>(`/schedules/slots/${id}/lock`, { method: 'POST' });

  reorderSlots = (items: { slot_id: number; order: number }[]) =>
    this.request<any>('/schedules/slots/reorder', { method: 'POST', body: JSON.stringify(items) });

  assignDragDrop = (payload: {
    schedule_id: number;
    slot_id: number;
    person_id: number;
    override_conflicts?: boolean;
  }) =>
    this.request<any>('/schedules/assign-drag-drop', { method: 'POST', body: JSON.stringify(payload) });

  prePublishCheck = (scheduleId: number) =>
    this.request<any>(`/schedules/${scheduleId}/pre-publish-check`);

  copyWeek = (scheduleId: number, payload: { target_period_start: string; target_period_end: string }) =>
    this.request<any>(`/schedules/${scheduleId}/copy-week`, { method: 'POST', body: JSON.stringify(payload) });

  updateAssignment = (id: number, payload: any) =>
    this.request<any>(`/schedules/assignments/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

  publishSchedule = (id: number) =>
    this.request<any>(`/schedules/${id}/publish`, { method: 'POST' });

  // Search
  searchNLP = (orgId: number, query: string, topK: number = 5) =>
    this.request<any>('/search', {
      method: 'POST',
      body: JSON.stringify({ org_id: orgId, query, top_k: topK }),
    });

  // Replacements & Swaps
  getActiveReplacements = (orgId: number) =>
    this.request<any[]>(`/replacements/active?org_id=${orgId}`);

  getPendingReturns = (orgId: number) =>
    this.request<any[]>(`/replacements/pending-returns?org_id=${orgId}`);

  recommendReplacement = (orgId: number, assignmentId: number) =>
    this.request<any>('/replacements/recommend', {
      method: 'POST',
      body: JSON.stringify({ org_id: orgId, assignment_id: assignmentId }),
    });

  approveReplacement = (payload: {
    org_id: number;
    assignment_id: number;
    replacement_person_id: number;
    replacement_type: string;
    reason: string;
  }) =>
    this.request<any>('/replacements/approve', { method: 'POST', body: JSON.stringify(payload) });

  restoreReplacement = (logId: number) =>
    this.request<any>(`/replacements/restore/${logId}`, { method: 'POST' });

  getReplacementHistory = (orgId: number) =>
    this.request<any[]>(`/replacements/history?org_id=${orgId}`);

  getSwaps = (orgId: number) =>
    this.request<any[]>(`/replacements/swaps?org_id=${orgId}`);

  createSwap = (payload: any) =>
    this.request<any>('/replacements/swaps', { method: 'POST', body: JSON.stringify(payload) });

  approveSwap = (swapId: number) =>
    this.request<any>(`/replacements/swaps/${swapId}/approve`, { method: 'POST' });

  // Leave
  getLeaves = (orgId: number) =>
    this.request<any[]>(`/leave?org_id=${orgId}`);

  submitEmergencyLeave = (payload: {
    person_id: number;
    org_id: number;
    start_date: string;
    end_date: string;
    reason: string;
  }) =>
    this.request<any>('/leave/emergency', { method: 'POST', body: JSON.stringify(payload) });

  requestDayOff = (payload: any) =>
    this.request<any>('/leave/request-day-off', { method: 'POST', body: JSON.stringify(payload) });

  approveLeave = (id: number) =>
    this.request<any>(`/leave/${id}/approve`, { method: 'POST' });

  rejectLeave = (id: number) =>
    this.request<any>(`/leave/${id}/reject`, { method: 'POST' });

  returnToWork = (payload: { org_id: number; leave_request_id: number; person_id: number }) =>
    this.request<any>('/leave/return-to-work', { method: 'POST', body: JSON.stringify(payload) });

  getAvailabilityRules = (personId: number) =>
    this.request<any[]>(`/leave/rules/${personId}`);

  updateAvailabilityRules = (personId: number, rules: any[]) =>
    this.request<any>('/leave/rules', { method: 'POST', body: JSON.stringify({ person_id: personId, rules }) });

  // Intelligence
  getSkillIntelligence = (orgId: number) =>
    this.request<any>(`/intelligence/skills?org_id=${orgId}`);

  // Fairness
  getFairness = (orgId: number, scheduleId?: number) => {
    const q = scheduleId ? `?org_id=${orgId}&schedule_id=${scheduleId}` : `?org_id=${orgId}`;
    return this.request<any>(`/fairness${q}`);
  };

  // Issues
  getIssues = (orgId: number) =>
    this.request<any>(`/issues?org_id=${orgId}`);

  // Team Builder
  findTeam = (payload: any) =>
    this.request<any>('/team-builder/find-team', { method: 'POST', body: JSON.stringify(payload) });

  // Analytics
  getAnalytics = (orgId: number) =>
    this.request<any>(`/analytics?org_id=${orgId}`);

  // History
  getVersions = (scheduleId: number) =>
    this.request<any[]>(`/history/versions/${scheduleId}`);

  rollbackVersion = (versionId: number) =>
    this.request<any>(`/history/rollback/${versionId}`, { method: 'POST' });

  getAuditLogs = (orgId: number) =>
    this.request<any[]>(`/history/audit-logs?org_id=${orgId}`);

  // Notifications
  getNotifications = (orgId: number) =>
    this.request<any>(`/notifications?org_id=${orgId}`);

  markNotificationRead = (id: number) =>
    this.request<any>(`/notifications/${id}/read`, { method: 'POST' });

  markAllNotificationsRead = (orgId: number) =>
    this.request<any>(`/notifications/read-all?org_id=${orgId}`, { method: 'POST' });

  // Settings
  getSettings = (orgId: number) =>
    this.request<any>(`/settings/${orgId}`);

  updateSettings = (orgId: number, settings: any) =>
    this.request<any>('/settings', { method: 'PUT', body: JSON.stringify({ org_id: orgId, settings }) });

  // Holiday Management
  getHolidays = (orgId: number, params?: { department_id?: number; holiday_type?: string; search?: string; start_date?: string; end_date?: string }) => {
    const searchParams = new URLSearchParams({ org_id: String(orgId) });
    if (params?.department_id) searchParams.append('department_id', String(params.department_id));
    if (params?.holiday_type && params.holiday_type !== 'all') searchParams.append('holiday_type', params.holiday_type);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    return this.request<any[]>(`/holidays?${searchParams.toString()}`);
  };

  createHoliday = (payload: any) =>
    this.request<any>('/holidays', { method: 'POST', body: JSON.stringify(payload) });

  updateHoliday = (id: number, payload: any) =>
    this.request<any>(`/holidays/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

  deleteHoliday = (id: number) =>
    this.request<any>(`/holidays/${id}`, { method: 'DELETE' });

  getHolidayImpact = (orgId: number) =>
    this.request<any>(`/holidays/impact?org_id=${orgId}`);

  getHolidayPresets = () =>
    this.request<any[]>('/holidays/presets/list');

  loadHolidayPreset = (orgId: number, presetId: string) =>
    this.request<any>('/holidays/presets/load', { method: 'POST', body: JSON.stringify({ org_id: orgId, preset_id: presetId }) });

  previewHolidayImport = async (orgId: number, file: File) => {
    const formData = new FormData();
    formData.append('org_id', String(orgId));
    formData.append('file', file);
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}/holidays/import/preview`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to preview holiday file' }));
      throw new Error(err.detail || 'Failed to preview holiday file');
    }
    return res.json();
  };

  commitHolidayImport = (orgId: number, holidays: any[]) =>
    this.request<any>('/holidays/import/commit', { method: 'POST', body: JSON.stringify({ org_id: orgId, holidays }) });

  getHolidayExportUrl = (orgId: number) =>
    `${API_BASE}/holidays/export?org_id=${orgId}`;

  createHolidayException = (holidayId: number, payload: any) =>
    this.request<any>(`/holidays/${holidayId}/exceptions`, { method: 'POST', body: JSON.stringify(payload) });

  deleteHolidayException = (exceptionId: number) =>
    this.request<any>(`/holidays/exceptions/${exceptionId}`, { method: 'DELETE' });
}

export const api = new ApiClient();
