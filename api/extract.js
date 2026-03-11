export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { imageBase64, mediaType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'No image' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        temperature: 0,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 }
              },
              {
                type: 'text',
                text: `당신은 한국 영수증/계산서 전문 판독 AI입니다.
이미지에서 정보를 최대한 정확하게 추출하여 아래 JSON 형식으로만 응답하세요.
JSON 외 어떤 텍스트도 출력하지 마세요. 마크다운 코드블록도 사용하지 마세요.

[추출 규칙]
1. 날짜: 영수증에서 거래일자를 찾아 YYMMDD 형식으로 변환 (예: 2026.03.08 → 260308)
2. 내용: "YYMMDD 업종/용도" 형식 (예: "260308 식대", "260308 택시비", "260308 사무용품")
   - 날짜가 없으면 내용만 작성
   - 업종은 영수증의 업태/업종란 또는 상호명으로 판단
3. 거래처: 상호명 또는 가맹점명을 그대로 입력 (예: "스타벅스 강남점", "GS25 역삼점")
4. 연락처: 영수증에 전화번호가 명시된 경우만 입력, 없으면 반드시 빈 문자열
5. 금액: 최종 결제금액(합계/total)을 숫자만 입력 (쉼표, 원, ₩ 기호 제외)
   - 카드영수증: "승인금액" 또는 "결제금액" 우선
   - 현금영수증: "합계금액" 우선
   - 수기영수증이거나 금액이 전혀 판독 불가능하면 "?"
6. 입금계좌: 항상 빈 문자열

[응답 형식 - 이것만 출력]
{"내용":"YYMMDD 용도","거래처":"상호명","연락처":"","금액":"숫자또는?","입금계좌":""}`
              }
            ]
          }
        ]
      })
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
