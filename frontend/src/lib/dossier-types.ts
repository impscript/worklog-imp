export type DossierTrackMode = 'career_review' | 'promotion_track';
export type DossierAccentTheme = 'indigo' | 'emerald' | 'cyan' | 'violet';

export interface DossierFeaturedProject {
  id: string;
  project_name: string;
  title: string;
  category?: string;
  summary: string;
  impact_metric?: string;
  image_url?: string;
  live_url?: string;
}

export interface UserDossierConfig {
  id?: string;
  user_id: string;
  is_public: boolean;
  track_mode: DossierTrackMode;
  target_role?: string;
  headline?: string;
  bio?: string;
  hero_image_url?: string;
  accent_theme: DossierAccentTheme;
  featured_projects: DossierFeaturedProject[];
  supervisor_quote?: string;
  supervisor_name?: string;
  supervisor_title?: string;
  updated_at?: string;
}

export interface MemberDossierProfile {
  id: string;
  full_name: string;
  nickname?: string;
  position?: string;
  employee_level?: string;
  company_name?: string;
  department?: string;
  role_start_date?: string;
  manager_name?: string;
  email?: string;
  emp_id?: string;
}

export interface MemberProjectAggregate {
  name: string;
  taskCount: number;
  totalHours: number;
  latestDate: string;
  highlight: string;
}

export interface MemberDossierStats {
  totalHours: number;
  totalDays: number;
  totalTasks: number;
  projects: string[];
  projectSummaries: MemberProjectAggregate[];
  recentLogs: Array<{
    id: string;
    work_date: string;
    task_title: string;
    task_description?: string;
    total_hours: number;
    project_name?: string;
  }>;
}

export interface MemberDossierJd {
  position_name?: string;
  jd_text?: string;
  key_responsibilities?: Array<{ category: string; weight: number }>;
}

export interface MemberAppraisalSummary {
  id: string;
  cycle: 'half_year' | 'end_year';
  overallScore: number;
  level: string;
  confidence: string;
  period: string;
  modelName: string;
  executiveSummary?: string;
  coveragePct: number | null;
  loggedDays: number | null;
  businessDays: number | null;
  shareToken: string | null;
  isPublic: boolean;
  topStrengths: string[];
  pillars: {
    quantity: number;
    quality: number;
    learning: number;
    accountability: number;
    proactiveness: number;
  };
}

export function createDefaultDossierConfig(userId: string): UserDossierConfig {
  return {
    user_id: userId,
    is_public: true,
    track_mode: 'career_review',
    target_role: '',
    headline: '',
    bio: '',
    hero_image_url: '',
    accent_theme: 'indigo',
    featured_projects: [],
    supervisor_quote: '',
    supervisor_name: '',
    supervisor_title: '',
  };
}
