export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'director' | 'range_officer' | 'guard' | 'range_office' | 'tiger_cell';
export type TaskStatus = 'NotStarted' | 'InProgress' | 'Completed' | 'Archived';
export type TaskPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type TaskCategory = 'Patrol' | 'Camera Trap' | 'Survey' | 'Maintenance' | 'Admin' | 'Other';
export type NotificationType = 'task_assigned' | 'task_updated' | 'task_completed' | 'changes_requested' | 'task_archived';
export type IncidentType = 'human_attack' | 'livestock_attack' | 'crop_damage' | 'property_damage' | 'poaching_sign' | 'wildlife_sighting' | 'road_kill' | 'other';
export type IncidentSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

type Relationships = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
}[];

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
        Insert: {
          id: string;
          name: string;
          role: UserRole;
          email: string;
          phone?: string | null;
          avatar_initials: string;
          designation: string;
          range_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          role?: UserRole;
          email?: string;
          phone?: string | null;
          avatar_initials?: string;
          designation?: string;
          range_id?: string | null;
        };
        Relationships: Relationships;
      };
      ranges: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name: string };
        Update: { id?: string; name?: string };
        Relationships: Relationships;
      };
      areas: {
        Row: { id: string; range_id: string; name: string; created_at: string };
        Insert: { id?: string; range_id: string; name: string };
        Update: { id?: string; range_id?: string; name?: string };
        Relationships: Relationships;
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
          category_other: string | null;
          due_date: string;
          completion_percentage: number;
          acknowledged_at: string | null;
          completed_at: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string;
          assignee_id: string;
          created_by_id: string;
          range_id: string;
          area_id?: string | null;
          status?: TaskStatus;
          priority: TaskPriority;
          category: TaskCategory;
          category_other?: string | null;
          due_date: string;
          completion_percentage?: number;
          acknowledged_at?: string | null;
          completed_at?: string | null;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          assignee_id?: string;
          created_by_id?: string;
          range_id?: string;
          area_id?: string | null;
          status?: TaskStatus;
          priority?: TaskPriority;
          category?: TaskCategory;
          category_other?: string | null;
          due_date?: string;
          completion_percentage?: number;
          acknowledged_at?: string | null;
          completed_at?: string | null;
          archived_at?: string | null;
        };
        Relationships: Relationships;
      };
      task_updates: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          note: string;
          progress_percentage: number;
          lat: number | null;
          lng: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          user_id: string;
          note: string;
          progress_percentage: number;
          lat?: number | null;
          lng?: number | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          user_id?: string;
          note?: string;
          progress_percentage?: number;
          lat?: number | null;
          lng?: number | null;
        };
        Relationships: Relationships;
      };
      comments: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          user_id: string;
          content: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          user_id?: string;
          content?: string;
        };
        Relationships: Relationships;
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
        Insert: {
          id?: string;
          task_id: string;
          user_id: string;
          name: string;
          url: string;
          size: number;
          mime_type: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          user_id?: string;
          name?: string;
          url?: string;
          size?: number;
          mime_type?: string;
        };
        Relationships: Relationships;
      };
      task_assignees: {
        Row: {
          task_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          task_id: string;
          user_id: string;
        };
        Update: {
          task_id?: string;
          user_id?: string;
        };
        Relationships: Relationships;
      };
      officer_ranges: {
        Row: {
          user_id: string;
          range_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          range_id: string;
        };
        Update: {
          user_id?: string;
          range_id?: string;
        };
        Relationships: Relationships;
      };
      live_locations: {
        Row: {
          user_id: string;
          task_id: string;
          lat: number;
          lng: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          task_id: string;
          lat: number;
          lng: number;
        };
        Update: {
          user_id?: string;
          task_id?: string;
          lat?: number;
          lng?: number;
        };
        Relationships: Relationships;
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
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title: string;
          message: string;
          task_id: string;
          read?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: NotificationType;
          title?: string;
          message?: string;
          task_id?: string;
          read?: boolean;
        };
        Relationships: Relationships;
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
        };
        Relationships: Relationships;
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
        Insert: {
          id?: string;
          report_date: string;
          generated_by: string;
          total_tasks: number;
          completed_count: number;
          in_progress_count: number;
          not_started_count: number;
          overdue_count: number;
          range_breakdown: Json;
        };
        Update: {
          id?: string;
          report_date?: string;
          generated_by?: string;
          total_tasks?: number;
          completed_count?: number;
          in_progress_count?: number;
          not_started_count?: number;
          overdue_count?: number;
          range_breakdown?: Json;
        };
        Relationships: Relationships;
      };
      incidents: {
        Row: {
          id: string;
          type: IncidentType;
          severity: IncidentSeverity;
          description: string;
          range_id: string;
          area_id: string | null;
          lat: number | null;
          lng: number | null;
          reported_by: string;
          incident_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: IncidentType;
          severity?: IncidentSeverity;
          description: string;
          range_id: string;
          area_id?: string | null;
          lat?: number | null;
          lng?: number | null;
          reported_by: string;
          incident_date?: string;
        };
        Update: {
          id?: string;
          type?: IncidentType;
          severity?: IncidentSeverity;
          description?: string;
          range_id?: string;
          area_id?: string | null;
          lat?: number | null;
          lng?: number | null;
          reported_by?: string;
          incident_date?: string;
        };
        Relationships: Relationships;
      };
      incident_photos: {
        Row: {
          id: string;
          incident_id: string;
          uploaded_by: string;
          path: string;
          size: number;
          mime_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          incident_id: string;
          uploaded_by: string;
          path: string;
          size: number;
          mime_type?: string;
        };
        Update: {
          id?: string;
          incident_id?: string;
          uploaded_by?: string;
          path?: string;
          size?: number;
          mime_type?: string;
        };
        Relationships: Relationships;
      };
      audit_log: {
        Row: {
          id: string;
          task_id: string | null;
          task_title: string;
          range_id: string | null;
          actor_id: string;
          action: string;
          detail: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id?: string | null;
          task_title?: string;
          range_id?: string | null;
          actor_id: string;
          action: string;
          detail?: string;
        };
        Update: {
          id?: string;
          task_id?: string | null;
          task_title?: string;
          range_id?: string | null;
          actor_id?: string;
          action?: string;
          detail?: string;
        };
        Relationships: Relationships;
      };
    };
    Views: {
      task_dashboard_stats: {
        Row: {
          total_tasks: number;
          critical_count: number;
          in_progress_count: number;
          completed_count: number;
          archived_count: number;
          overdue_count: number;
        };
        Relationships: Relationships;
      };
      task_range_stats: {
        Row: {
          range_id: string;
          range_name: string;
          total: number;
          not_started_count: number;
          in_progress_count: number;
          completed_count: number;
          archived_count: number;
          completed: number;
          overdue: number;
        };
        Relationships: Relationships;
      };
    };
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      task_category: TaskCategory;
      notification_type: NotificationType;
      incident_type: IncidentType;
      incident_severity: IncidentSeverity;
    };
  };
}
