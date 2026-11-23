// 미라클톡 4단계: 프로필 아바타 목록 (직업 테마 24개, 그림: 라이라)
//
// 그림은 avatars/jobs/ 폴더 (256x256 WebP, 원본 512px PNG에서 원 안쪽만 잘라 변환)
// 주의: id는 한 번 정하면 바꾸지 마세요. (사람들이 고른 아바타가 id로 저장돼요)
//       id 규칙: 영어 소문자, 숫자, -, _ 만 (20자 이내)
//       새 아바타를 추가할 때는 맨 아래에 job_25 처럼 이어 붙이면 돼요.

export const AVATARS = [
  { id: "job_01", label: "AI 개발자",       file: "01_ai_developer" },
  { id: "job_02", label: "디자이너",        file: "02_designer" },
  { id: "job_03", label: "선생님",          file: "03_teacher" },
  { id: "job_04", label: "의사",            file: "04_doctor" },
  { id: "job_05", label: "엔지니어",        file: "05_engineer" },
  { id: "job_06", label: "크리에이터",      file: "06_creator" },
  { id: "job_07", label: "요리사",          file: "07_chef" },
  { id: "job_08", label: "스마트팜 농부",   file: "08_smart_farmer" },
  { id: "job_09", label: "뮤지션",          file: "09_musician" },
  { id: "job_10", label: "여행가",          file: "10_traveler" },
  { id: "job_11", label: "창업가",          file: "11_entrepreneur" },
  { id: "job_12", label: "사회복지사",      file: "12_social_worker" },
  { id: "job_13", label: "간호사",          file: "13_nurse" },
  { id: "job_14", label: "건축·토목 전문가", file: "14_architect" },
  { id: "job_15", label: "연구원·과학자",   file: "15_scientist" },
  { id: "job_16", label: "데이터 분석가",   file: "16_data_analyst" },
  { id: "job_17", label: "영상 크리에이터", file: "17_video_creator" },
  { id: "job_18", label: "자영업자",        file: "18_small_business_owner" },
  { id: "job_19", label: "상담사",          file: "19_counselor" },
  { id: "job_20", label: "공무원",          file: "20_civil_servant" },
  { id: "job_21", label: "변호사",          file: "21_lawyer" },
  { id: "job_22", label: "기자",            file: "22_journalist" },
  { id: "job_23", label: "소방관",          file: "23_firefighter" },
  { id: "job_24", label: "경찰관",          file: "24_police_officer" },
];

const byId = new Map(AVATARS.map((a) => [a.id, a]));

export function findAvatar(id) {
  return (id && byId.get(id)) || null;
}

// GitHub Pages 하위 경로(/miracletalk/)에서도 되도록 상대 경로 사용
export function avatarImagePath(a) {
  return `avatars/jobs/${a.file}.webp`;
}
