export interface Series {
  id: string;
  series_type: string;
  series_year: number;
  series_sem: number;
  series_name: string;
  series_task: string;
  created_at: string;
}

export interface Student {
  id: string;
  student_name: string;
  email: string | null;
  auth_user_id: string | null;
  series_types: string[];
  status: 'active' | 'inactive';
  created_at: string;
}

export interface SeriesTaskRecord {
  id: string;
  student_id: string;
  series_id: string;
  student_done: boolean;
  teacher_confirmed: boolean;
  remarks: string | null;
  drive_file_id: string | null;
  drive_file_name: string | null;
  drive_file_url: string | null;
  drive_files: { fileId: string; fileName: string; webViewLink: string }[];
  created_at: string;
  updated_at: string;
  // joined fields
  students?: { student_name: string; status: 'active' | 'inactive' };
  series?: { series_type: string; series_name: string; series_task: string };
}

export interface AppSettings {
  id: string;
  current_sem: number;
  updated_at: string;
}

export interface ScriptureRecord {
  id: string;
  student_id: string;
  scripture_mode: string;
  scripture_part: string;
  created_at: string;
  // joined fields
  students?: { student_name: string; status: 'active' | 'inactive' };
}

export type SeriesTaskRecordWithJoins = SeriesTaskRecord & {
  students: { student_name: string; status: 'active' | 'inactive' };
  series: { series_type: string; series_name: string; series_task: string };
};

export type ScriptureRecordWithJoins = ScriptureRecord & {
  students: { student_name: string; status: 'active' | 'inactive' };
};
