export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'director' | 'range_officer' | 'guard';
export type TaskStatus = 'NotStarted' | 'InProgress' | 'Completed' | 'Archived';
export type TaskPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type TaskCategory = 'Patrol' | 'Camera Trap' | 'Survey' | 'Maintenance' | 'Admin' | 'Other';
export type NotificationType = 'task_assigned' | 'task_updated' | 'task_completed' | 'changes_requested' | 'task_archived';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          role: UserRole;
          email: string;
          phone: string | null;
          avatar_initials: string;
          designation: string;
          range_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      ranges: {
        Row: { id: string; name: string; created_at: string };
        Insert: Omit<Database['public']['Tables']['ranges']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['ranges']['Insert']>;
      };
      areas: {
        Row: { id: string; range_id: string; name: string; created_at: string };
        Insert: Omit<Database['public']['Tables']['areas']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['areas']['Insert']>;
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string;
          assignee_id: string;
          created_by_id: string;
          range_id: string;
          area_id: string | null;
          status: TaskStatus;
          priority: TaskPriority;
          category: TaskCategory;
          due_date: string;
          completion_percentage: number;
          acknowledged_at: string | null;
          completed_at: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['tasks']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
      };
      task_updates: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          note: string;
          progress_percentage: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['task_updates']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['task_updates']['Insert']>;
      };
      comments: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['comments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['comments']['Insert']>;
      };
      attachments: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          name: string;
          url: string;
          size: number;
          mime_type: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['attachments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['attachments']['Insert']>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          message: string;
          task_id: string;
          read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };
      daily_reports: {
        Row: {
          id: string;
          report_date: string;
          generated_by: string;
          total_tasks: number;
          completed_count: number;
          in_progress_count: number;
          not_started_count: number;
          overdue_count: number;
          range_breakdown: Json;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['daily_reports']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['daily_reports']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      task_category: TaskCategory;
      notification_type: NotificationType;
    };
  };
}
