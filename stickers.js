// 미라클톡 5단계: 스티커 목록 (그림: 라이라)
// 파일은 stickers/ 폴더 (투명 WebP, 320x320, 움직이는 그림 가능)
// 주의: id는 한 번 정하면 바꾸지 마세요. (보낸 메시지에 id로 저장돼요)
//       id 규칙: 영어 소문자, 숫자, -, _ 만 (30자 이내)
//       새 스티커는 맨 아래에 이어 붙이면 돼요.

export const STICKERS = [
  { id: "miracle_best", label: "미라클 최고", file: "stickers/miracle_best.webp" },
  { id: "mira_hello", label: "안녕!", file: "stickers/mira_hello.webp" },
  { id: "mira_good", label: "좋아요", file: "stickers/mira_good.webp" },
  { id: "mira_thanks", label: "고마워요", file: "stickers/mira_thanks.webp" },
  { id: "mira_please", label: "부탁해요", file: "stickers/mira_please.webp" },
  { id: "mira_cry", label: "엉엉", file: "stickers/mira_cry.webp" },
  { id: "mira_angry", label: "화났어", file: "stickers/mira_angry.webp" },
  { id: "mira_wow", label: "깜짝!", file: "stickers/mira_wow.webp" },
  { id: "mira_sleep", label: "졸려요", file: "stickers/mira_sleep.webp" },
  { id: "mira_congrats", label: "축하해요", file: "stickers/mira_congrats.webp" },
];

const byId = new Map(STICKERS.map((s) => [s.id, s]));

export function findSticker(id) {
  return (id && byId.get(id)) || null;
}
