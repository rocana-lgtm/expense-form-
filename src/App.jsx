import { useState, useRef } from "react";

const emptyItem = () => ({
  id: Date.now() + Math.random(),
  image: null, imageBase64: null, mediaType: "image/jpeg", loading: false,
  내용: "", 거래처: "", 연락처: "", 금액: "", 입금계좌: "", 출금계좌: ""
});

const koreanAlpha = (idx) => ["가","나","다","라","마","바","사","아","자","차"][idx] || String(idx+1);

const toKorean = (n) => {
  if (!n) return "";
  const units = ["","일","이","삼","사","오","육","칠","팔","구"];
  const places = ["","십","백","천"];
  const bigPlaces = ["","만","억","조"];
  let result = ""; const groups = []; let tmp = n;
  while (tmp > 0) { groups.push(tmp % 10000); tmp = Math.floor(tmp / 10000); }
  for (let g = groups.length - 1; g >= 0; g--) {
    const v = groups[g]; if (v === 0) continue;
    let s = "";
    for (let p = 3; p >= 0; p--) {
      const d = Math.floor(v / Math.pow(10, p)) % 10;
      if (d === 0) continue;
      s += (d === 1 && p > 0 ? "" : units[d]) + places[p];
    }
    result += s + bigPlaces[g];
  }
  return result + "원정";
};

const readFile = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const mediaType = dataUrl.startsWith("data:image/png") ? "image/png"
      : dataUrl.startsWith("data:image/webp") ? "image/webp"
      : dataUrl.startsWith("data:image/gif") ? "image/gif"
      : "image/jpeg";
    resolve({ image: dataUrl, imageBase64: dataUrl.split(",")[1], mediaType });
  };
  reader.readAsDataURL(file);
});

export default function App() {
  const [items, setItems] = useState([emptyItem()]);
  const [header, setHeader] = useState({ 기안일: "", 기안자: "", 소속직책: "", 제목: "", 지급기한: "" });
  const [step, setStep] = useState("upload");
  const [errorMsg, setErrorMsg] = useState("");
  const singleRefs = useRef({});
  const galleryRef = useRef();
  const cameraRef = useRef();
  const pcRef = useRef();

  const updateItem = (id, patch) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));

  const handleMultiFiles = async (files) => {
    if (!files || files.length === 0) return;
    const results = await Promise.all(Array.from(files).map(readFile));
    setItems(prev => {
      let updated = [...prev];
      let ri = 0;
      updated = updated.map(it => (!it.image && ri < results.length) ? { ...it, ...results[ri++] } : it);
      while (ri < results.length) updated.push({ ...emptyItem(), ...results[ri++] });
      return updated;
    });
  };

  const handleSingleFile = async (id, file) => {
    if (!file) return;
    const data = await readFile(file);
    updateItem(id, data);
  };

  const extractOne = async (id) => {
    const item = items.find(it => it.id === id);
    if (!item?.imageBase64) return;
    updateItem(id, { loading: true });
    setErrorMsg("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: item.mediaType, data: item.imageBase64 } },
              {
                type: "text",
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
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const text = data.content?.find(b => b.type === "text")?.text || "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      updateItem(id, { ...parsed, loading: false });
    } catch (err) {
      setErrorMsg("오류: " + (err.message || "알 수 없는 오류"));
      updateItem(id, { loading: false });
    }
  };

  const extractAll = async () => {
    for (const item of items) {
      if (item.imageBase64 && !item.내용) await extractOne(item.id);
    }
    setStep("result");
  };

  const totalAmount = items.reduce((sum, it) => sum + (parseInt(it.금액?.replace(/,/g,"") || "0") || 0), 0);
  const tdB = { border: "1px solid #333" };
  const tdBL = { border: "1px solid #bbb" };

  return (
    <div style={{ fontFamily: "'Noto Sans KR', sans-serif", minHeight: "100vh", background: "#f0f2f5", fontSize: 13 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0} input{outline:none} @media print{.np{display:none!important} body{background:white}}`}</style>

      <div className="np" style={{ background: "#1a1a2e", color: "white", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>📄 품의서 자동완성</div>
          <div style={{ fontSize: 11, color: "#8888aa" }}>영수증 여러 장 → 품의서 1장</div>
        </div>
        {step === "result" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep("upload")} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #555", background: "transparent", color: "#ccc", cursor: "pointer", fontSize: 12 }}>← 수정</button>
            <button onClick={() => window.print()} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#4f8ef7", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>🖨️ 인쇄/PDF</button>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px" }}>
        {errorMsg && <div className="np" style={{ background: "#fff0f0", border: "1px solid #ffaaaa", borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: "#cc0000", fontSize: 12 }}>⚠️ {errorMsg}</div>}

        {step === "upload" && (
          <div className="np">
            <div style={{ background: "white", borderRadius: 12, padding: "18px 20px", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
              <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>📋 기본 정보</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                {[["기안일","기안일"],["기안자","기안자"],["소속/직책","소속직책"]].map(([label,key]) => (
                  <div key={key}>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>{label}</div>
                    <input value={header[key]} onChange={e => setHeader(p => ({ ...p, [key]: e.target.value }))}
                      style={{ width: "100%", border: "1px solid #ddd", borderRadius: 6, padding: "6px 10px", fontSize: 13 }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["제목","제목"],["지급기한","지급기한"]].map(([label,key]) => (
                  <div key={key}>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>{label}</div>
                    <input value={header[key]} onChange={e => setHeader(p => ({ ...p, [key]: e.target.value }))}
                      style={{ width: "100%", border: "1px solid #ddd", borderRadius: 6, padding: "6px 10px", fontSize: 13 }} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "white", borderRadius: 12, padding: "16px 20px", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
              <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>🖼️ 영수증 올리기</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <button onClick={() => galleryRef.current?.click()}
                  style={{ padding: "12px 8px", borderRadius: 10, border: "2px solid #4f8ef7", background: "#f0f6ff", color: "#1a5ec4", fontWeight: 700, fontSize: 13, cursor: "pointer", lineHeight: 1.6 }}>
                  🖼️ 갤러리<br/><span style={{ fontSize: 10, fontWeight: 400, color: "#888" }}>여러 장 선택</span>
                </button>
                <input ref={galleryRef} type="file" multiple style={{ display: "none" }} onChange={e => handleMultiFiles(e.target.files)} />

                <button onClick={() => cameraRef.current?.click()}
                  style={{ padding: "12px 8px", borderRadius: 10, border: "2px solid #34a853", background: "#f0fff4", color: "#1a7a3a", fontWeight: 700, fontSize: 13, cursor: "pointer", lineHeight: 1.6 }}>
                  📷 카메라<br/><span style={{ fontSize: 10, fontWeight: 400, color: "#888" }}>바로 촬영</span>
                </button>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleMultiFiles(e.target.files)} />

                <button onClick={() => pcRef.current?.click()}
                  style={{ padding: "12px 8px", borderRadius: 10, border: "2px solid #888", background: "#f8f8f8", color: "#444", fontWeight: 700, fontSize: 13, cursor: "pointer", lineHeight: 1.6 }}>
                  💻 PC 파일<br/><span style={{ fontSize: 10, fontWeight: 400, color: "#888" }}>Ctrl+클릭 다중선택</span>
                </button>
                <input ref={pcRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleMultiFiles(e.target.files)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14, marginBottom: 14 }}>
              {items.map((item, idx) => (
                <div key={item.id} style={{ background: "white", borderRadius: 12, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>영수증 {idx + 1}</div>
                    {items.length > 1 && (
                      <button onClick={() => setItems(p => p.filter(i => i.id !== item.id))}
                        style={{ border: "none", background: "none", color: "#ccc", cursor: "pointer", fontSize: 15 }}>✕</button>
                    )}
                  </div>
                  <div onClick={() => singleRefs.current[item.id]?.click()}
                    style={{ border: item.image ? "2px solid #4f8ef7" : "2px dashed #ddd", borderRadius: 8, height: 110, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", marginBottom: 8, background: "#fafafa" }}>
                    {item.image
                      ? <img src={item.image} style={{ maxHeight: 106, maxWidth: "100%", objectFit: "contain" }} alt="" />
                      : <div style={{ textAlign: "center", color: "#bbb" }}><div style={{ fontSize: 24 }}>🧾</div><div style={{ fontSize: 11, marginTop: 3 }}>탭하여 변경</div></div>
                    }
                  </div>
                  <input type="file" ref={el => singleRefs.current[item.id] = el}
                    style={{ display: "none" }} onChange={e => handleSingleFile(item.id, e.target.files[0])} />
                  {item.image && (
                    <button onClick={() => extractOne(item.id)} disabled={item.loading}
                      style={{ width: "100%", padding: "6px", borderRadius: 7, border: "none", background: item.loading ? "#eee" : "#1a1a2e", color: item.loading ? "#aaa" : "white", fontSize: 12, fontWeight: 600, cursor: item.loading ? "not-allowed" : "pointer", marginBottom: 7 }}>
                      {item.loading ? "⏳ 분석 중..." : item.내용 ? "✅ 재추출" : "✨ 자동 추출"}
                    </button>
                  )}
                  {["내용","거래처","금액"].map(key => (
                    <input key={key} value={item[key]} onChange={e => updateItem(item.id, { [key]: e.target.value })}
                      placeholder={key === "내용" ? "예: 260308 식대" : key}
                      style={{ width: "100%", border: "1px solid #eee", borderRadius: 5, padding: "5px 8px", fontSize: 12, marginBottom: 4 }} />
                  ))}
                </div>
              ))}
              <div onClick={() => setItems(p => [...p, emptyItem()])}
                style={{ border: "2px dashed #ddd", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", minHeight: 180, color: "#ccc", flexDirection: "column", gap: 6, background: "white" }}>
                <div style={{ fontSize: 30 }}>＋</div>
                <div style={{ fontSize: 12 }}>카드 추가</div>
              </div>
            </div>

            <button onClick={extractAll}
              style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: "#1a1a2e", color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              품의서 완성 →
            </button>
          </div>
        )}

        {step === "result" && (
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", padding: "28px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td rowSpan={3} style={{ ...tdB, padding: 10, fontWeight: 700, fontSize: 16, width: 170, textAlign: "center", verticalAlign: "middle" }}>품의 및 지출결의서</td>
                  <td colSpan={4} style={{ ...tdB, padding: 4, textAlign: "center", fontSize: 11, color: "#555" }}>결 재</td>
                </tr>
                <tr>{["담 당","팀장/부원장","원장","대표이사"].map(h => <td key={h} style={{ ...tdB, padding: 4, textAlign: "center", fontSize: 11, width: 82 }}>{h}</td>)}</tr>
                <tr>{[1,2,3,4].map(i => <td key={i} style={{ ...tdB, height: 44 }}></td>)}</tr>
              </tbody>
            </table>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {[["기 안 일","기안일"],["기 안 자","기안자"],["소속/직책","소속직책"]].map(([label,key]) => (
                  <tr key={key}>
                    <td style={{ ...tdB, padding: "6px 12px", fontWeight: 600, width: 170, background: "#f8f8f8" }}>{label}</td>
                    <td style={{ ...tdB, padding: "4px 10px" }}>
                      <input value={header[key]} onChange={e => setHeader(p => ({ ...p, [key]: e.target.value }))} style={{ border: "none", width: "100%", fontSize: 13, background: "transparent" }} />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...tdB, padding: "6px 12px", fontWeight: 600, background: "#f8f8f8" }}>제 목</td>
                  <td style={{ ...tdB, padding: "4px 10px" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <input value={header.제목} onChange={e => setHeader(p => ({ ...p, 제목: e.target.value }))} style={{ border: "none", flex: 1, fontSize: 13, background: "transparent" }} />
                      <span style={{ fontSize: 11, color: "#888" }}>지급기한</span>
                      <input value={header.지급기한} onChange={e => setHeader(p => ({ ...p, 지급기한: e.target.value }))} style={{ border: "none", width: 110, fontSize: 13, background: "transparent" }} />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ ...tdB, padding: "16px 14px", verticalAlign: "top", lineHeight: 2.2 }}>
                    <div style={{ marginBottom: 8 }}>아래와 같이 사유로 품의 및 지출결의서를 제출하오니 검토 후 승인하여 주시기 바랍니다.</div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>1. 내 용</div>
                    {items.map((item, idx) => (
                      <div key={item.id} style={{ marginLeft: 20 }}>{koreanAlpha(idx)}. {item.내용 || `항목 ${idx+1}`}</div>
                    ))}
                    <div style={{ fontWeight: 600, margin: "10px 0 4px" }}>
                      2. 소요금액 : ₩{totalAmount.toLocaleString()} &nbsp;( 일금 {toKorean(totalAmount)} )
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>3. 산출내역 및 결제 정보</div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f0f0f0" }}>
                          {["구 분","입금계좌 정보","거래처 / 연락처","금 액","출금계좌"].map(h => (
                            <td key={h} style={{ ...tdBL, padding: "5px 8px", textAlign: "center", fontWeight: 600, fontSize: 12 }}>{h}</td>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={item.id}>
                            <td style={{ ...tdBL, padding: "5px 8px", textAlign: "center", fontSize: 12 }}>{koreanAlpha(idx)}</td>
                            <td style={{ ...tdBL, padding: "4px 6px" }}>
                              <input value={item.입금계좌} onChange={e => updateItem(item.id, { 입금계좌: e.target.value })} style={{ width: "100%", border: "none", fontSize: 12, background: "transparent" }} />
                            </td>
                            <td style={{ ...tdBL, padding: "4px 6px" }}>
                              <div style={{ fontSize: 12 }}>{item.거래처}</div>
                              <div style={{ fontSize: 11, color: "#888" }}>{item.연락처}</div>
                            </td>
                            <td style={{ ...tdBL, padding: "5px 8px", textAlign: "right", fontSize: 12 }}>₩{(parseInt(item.금액?.replace(/,/g,"") || 0) || 0).toLocaleString()}</td>
                            <td style={{ ...tdBL, padding: "4px 6px" }}>
                              <input value={item.출금계좌} onChange={e => updateItem(item.id, { 출금계좌: e.target.value })} style={{ width: "100%", border: "none", fontSize: 12, background: "transparent" }} />
                            </td>
                          </tr>
                        ))}
                        <tr style={{ background: "#f8f8f8", fontWeight: 700 }}>
                          <td colSpan={3} style={{ ...tdBL, padding: "6px 8px", textAlign: "center" }}>합 계</td>
                          <td style={{ ...tdBL, padding: "6px 8px", textAlign: "right" }}>₩{totalAmount.toLocaleString()}</td>
                          <td style={{ ...tdBL }}></td>
                        </tr>
                      </tbody>
                    </table>
                    <div style={{ marginTop: 12 }}>
                      {items.map((_, idx) => <span key={idx} style={{ marginRight: 20 }}>첨부 {idx+1}. 영수증 {idx+1} 사본</span>)}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="np" style={{ marginTop: 12, padding: "10px 14px", background: "#fffbe6", borderRadius: 8, fontSize: 12, color: "#886600" }}>
              💡 각 칸 클릭해서 수정 가능 · 완성 후 인쇄하거나 PDF로 저장하세요
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
