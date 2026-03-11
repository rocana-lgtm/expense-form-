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
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
            {
              type: 'text',
              text: `이 영수증/계산서를 분석해서 아래 JSON 형식으로만 응답하세요. 절대 다른 말 하지 마세요.

규칙:
- "내용" 필드: 영수증에서 날짜를 찾아 YYMMDD 형식으로 변환 후 맨 앞에 붙이고, 한 칸 띄고 지출 내용 작성
  예시) "260308 스타벅스 음료비" / "260215 거래처 식대"
- 날짜가 없으면 날짜 없이 내용만 작성
- 금액은 숫자만 (쉼표·원 기호 없이)

{"내용":"YYMMDD 지출내용","거래처":"업체명","연락처":"전화번호없으면빈칸","금액":"숫자만","입금계좌":"","출금계좌":""}`
            }
          ]
        }]
      })
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
