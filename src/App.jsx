import { useState, useEffect, useCallback } from "react";

const ADMIN_PASSWORDS = {
  "Seylitair93": "full", // Admin complet - tous les droits
  "augustinsti2d22": "betonly" // Admin partiel - créer les paris seulement
};
const START_BALANCE = 500;
const CURRENCY = "💰";

export default function App() {
  const [screen, setScreen] = useState("login");
  const [pseudo, setPseudo] = useState("");
  const [inputPseudo, setInputPseudo] = useState("");
  const [adminInput, setAdminInput] = useState("");
  const [adminLevel, setAdminLevel] = useState(null); // "full" ou "betonly"
  const [users, setUsers] = useState({});
  const [bets, setBets] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("paris");
  const [toast, setToast] = useState(null);

  // Admin form
  const [nTitle, setNTitle] = useState("");
  const [nOpt1, setNOpt1] = useState("");
  const [nOpt2, setNOpt2] = useState("");

  // Bet modal
  const [modal, setModal] = useState(null);
  const [betAmt, setBetAmt] = useState("");
  const [selOpt, setSelOpt] = useState(null);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const u = await window.storage.get("cbusers", true);
      const b = await window.storage.get("cbbets", true);
      if (u) setUsers(JSON.parse(u.value));
      if (b) setBets(JSON.parse(b.value));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Poll for live updates
  useEffect(() => {
    if (screen === "main" || screen === "admin") {
      const id = setInterval(loadData, 5000);
      return () => clearInterval(id);
    }
  }, [screen, loadData]);

  const saveUsers = async (u) => {
    setUsers(u);
    await window.storage.set("cbusers", JSON.stringify(u), true);
  };
  const saveBets = async (b) => {
    setBets(b);
    await window.storage.set("cbbets", JSON.stringify(b), true);
  };

  const handleLogin = async () => {
    const p = inputPseudo.trim();
    if (!p) return;
    const upd = { ...users };
    if (!upd[p]) upd[p] = { balance: START_BALANCE };
    await saveUsers(upd);
    setPseudo(p);
    setScreen("main");
  };

  const handleAdminLogin = () => {
    const level = ADMIN_PASSWORDS[adminInput];
    if (level) {
      setAdminLevel(level);
      setScreen("admin");
      showToast(`Connecté en tant qu'admin (${level === "full" ? "Complet" : "Paris seulement"})`);
    } else {
      showToast("Mot de passe incorrect !", "err");
    }
  };

  const createBet = async () => {
    if (!nTitle || !nOpt1 || !nOpt2) return;
    const id = Date.now().toString();
    const upd = {
      ...bets,
      [id]: {
        title: nTitle,
        options: [{ label: nOpt1, total: 0 }, { label: nOpt2, total: 0 }],
        status: "open",
        winner: null,
        playerBets: {},
        createdAt: Date.now()
      }
    };
    await saveBets(upd);
    setNTitle(""); setNOpt1(""); setNOpt2("");
    showToast("Pari créé ✅");
  };

  const closeBet = async (betId, winnerIdx) => {
    const bet = bets[betId];
    const updUsers = { ...users };
    const totalPool = bet.options[0].total + bet.options[1].total;
    const winnerTotal = bet.options[winnerIdx].total;
    Object.entries(bet.playerBets).forEach(([p, pb]) => {
      if (!updUsers[p]) updUsers[p] = { balance: START_BALANCE };
      if (pb.option === winnerIdx && winnerTotal > 0) {
        updUsers[p].balance += Math.round((pb.amount / winnerTotal) * totalPool);
      }
    });
    const updBets = { ...bets, [betId]: { ...bet, status: "closed", winner: winnerIdx } };
    await saveUsers(updUsers);
    await saveBets(updBets);
    showToast("Pari clôturé 🎉");
  };

  const deleteBet = async (betId) => {
    const upd = { ...bets };
    delete upd[betId];
    await saveBets(upd);
    showToast("Pari supprimé");
  };

  const openModal = (betId) => {
    setModal(betId); setSelOpt(null); setBetAmt("");
  };

  const placeBet = async () => {
    const amt = parseInt(betAmt);
    if (!amt || amt <= 0 || selOpt === null) return;
    const user = users[pseudo];
    if (!user || user.balance < amt) { showToast("Solde insuffisant !", "err"); return; }
    const bet = bets[modal];
    if (bet.playerBets[pseudo]) { showToast("Tu as déjà misé !", "err"); return; }
    if (bet.status !== "open") { showToast("Pari fermé !", "err"); return; }
    const updUsers = { ...users, [pseudo]: { ...user, balance: user.balance - amt } };
    const updBet = {
      ...bet,
      options: bet.options.map((o, i) => i === selOpt ? { ...o, total: o.total + amt } : o),
      playerBets: { ...bet.playerBets, [pseudo]: { option: selOpt, amount: amt } }
    };
    await saveUsers(updUsers);
    await saveBets({ ...bets, [modal]: updBet });
    setModal(null);
    showToast("Mise enregistrée 🔥");
  };

  const sortedUsers = Object.entries(users)
    .sort((a, b) => b[1].balance - a[1].balance);

  const openBets = Object.entries(bets).filter(([, b]) => b.status === "open").sort((a,b)=>b[1].createdAt-a[1].createdAt);
  const closedBets = Object.entries(bets).filter(([, b]) => b.status === "closed").sort((a,b)=>b[1].createdAt-a[1].createdAt);

  if (loading) return (
    <div style={s.page}>
      <div style={s.loadBox}>
        <div style={s.emoji}>🎰</div>
        <div style={s.loadTxt}>Chargement...</div>
      </div>
    </div>
  );

  // LOGIN
  if (screen === "login") return (
    <div style={s.page}>
      {toast && <Toast toast={toast} />}
      <div style={s.card}>
        <div style={{...s.emoji, fontSize:48}}>🎰</div>
        <div style={s.title}>Paris de Classe</div>
        <div style={s.sub}>1STI2D2</div>
        <div style={s.divider} />
        <input style={s.input} placeholder="Ton pseudo..." value={inputPseudo}
          onChange={e => setInputPseudo(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()} />
        <button style={s.btnPrimary} onClick={handleLogin}>Rejoindre 🚀</button>
        <div style={s.divider} />
        <div style={s.adminRow}>
          <input style={{...s.input, flex:1, marginBottom:0}} type="password"
            placeholder="Mot de passe admin..." value={adminInput}
            onChange={e => setAdminInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdminLogin()} />
          <button style={s.btnSecondary} onClick={handleAdminLogin}>Admin</button>
        </div>
      </div>
    </div>
  );

  // ADMIN
  if (screen === "admin") return (
    <div style={s.page}>
      {toast && <Toast toast={toast} />}
      <div style={s.header}>
        <span style={s.headerTitle}>⚙️ Admin {adminLevel === "full" ? "Complet 👑" : "Paris seulement 📝"}</span>
        <button style={s.btnBack} onClick={() => {setScreen("login"); setAdminLevel(null);}}>← Déco</button>
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>Créer un pari</div>
        <input style={s.input} placeholder="Question (ex: Kévin va dormir en cours ?)" value={nTitle} onChange={e=>setNTitle(e.target.value)}/>
        <div style={s.row}>
          <input style={{...s.input, flex:1, marginBottom:0}} placeholder="Option A" value={nOpt1} onChange={e=>setNOpt1(e.target.value)}/>
          <span style={s.vs}>VS</span>
          <input style={{...s.input, flex:1, marginBottom:0}} placeholder="Option B" value={nOpt2} onChange={e=>setNOpt2(e.target.value)}/>
        </div>
        <button style={s.btnPrimary} onClick={createBet}>Créer le pari ➕</button>
      </div>

      {adminLevel === "full" && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Paris ouverts</div>
          {openBets.length === 0 && <div style={s.empty}>Aucun pari ouvert</div>}
          {openBets.map(([id, bet]) => (
            <div key={id} style={s.betCard}>
              <div style={s.betTitle}>{bet.title}</div>
              <div style={s.optRow}>
                {bet.options.map((o, i) => (
                  <div key={i} style={s.optChip}>
                    <span>{o.label}</span>
                    <span style={s.optAmt}>{CURRENCY}{o.total}</span>
                  </div>
                ))}
              </div>
              <div style={s.adminBtnRow}>
                <button style={{...s.btnSmall, background:"#22c55e"}} onClick={()=>closeBet(id,0)}>✅ {bet.options[0].label}</button>
                <button style={{...s.btnSmall, background:"#22c55e"}} onClick={()=>closeBet(id,1)}>✅ {bet.options[1].label}</button>
                <button style={{...s.btnSmall, background:"#ef4444"}} onClick={()=>deleteBet(id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adminLevel === "full" && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Classement</div>
          {sortedUsers.map(([name, u], i) => (
            <div key={name} style={s.rankRow}>
              <span style={s.rankNum}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`}</span>
              <span style={s.rankName}>{name}</span>
              <span style={s.rankBal}>{CURRENCY}{u.balance}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // MAIN (player)
  const myBal = users[pseudo]?.balance ?? START_BALANCE;
  return (
    <div style={s.page}>
      {toast && <Toast toast={toast} />}
      {modal && (
        <div style={s.overlay} onClick={()=>setModal(null)}>
          <div style={s.modalCard} onClick={e=>e.stopPropagation()}>
            <div style={s.betTitle}>{bets[modal]?.title}</div>
            <div style={s.optBtnRow}>
              {bets[modal]?.options.map((o,i)=>(
                <button key={i}
                  style={{...s.optBtn, ...(selOpt===i?s.optBtnSel:{})}}
                  onClick={()=>setSelOpt(i)}>
                  {o.label}<br/><span style={{fontSize:11,opacity:0.7}}>{CURRENCY}{o.total} misés</span>
                </button>
              ))}
            </div>
            <input style={s.input} type="number" placeholder={`Mise (solde: ${CURRENCY}${myBal})`}
              value={betAmt} onChange={e=>setBetAmt(e.target.value)} />
            <button style={s.btnPrimary} onClick={placeBet}>Miser 🔥</button>
            <button style={{...s.btnSecondary, marginTop:4}} onClick={()=>setModal(null)}>Annuler</button>
          </div>
        </div>
      )}

      <div style={s.header}>
        <div>
          <div style={s.headerTitle}>🎰 Paris 1STI2D2</div>
          <div style={s.headerSub}>Bonjour {pseudo} · {CURRENCY}{myBal}</div>
        </div>
        <button style={s.btnBack} onClick={()=>setScreen("login")}>← Déco</button>
      </div>

      <div style={s.tabRow}>
        <button style={{...s.tabBtn,...(tab==="paris"?s.tabActive:{})}} onClick={()=>setTab("paris")}>Paris</button>
        <button style={{...s.tabBtn,...(tab==="classement"?s.tabActive:{})}} onClick={()=>setTab("classement")}>Classement</button>
        <button style={{...s.tabBtn,...(tab==="historique"?s.tabActive:{})}} onClick={()=>setTab("historique")}>Historique</button>
      </div>

      {tab === "paris" && (
        <div style={s.section}>
          {openBets.length === 0 && <div style={s.empty}>Aucun pari en cours 😴<br/>L'admin va bientôt en créer !</div>}
          {openBets.map(([id, bet]) => {
            const myBet = bet.playerBets[pseudo];
            const total = bet.options[0].total + bet.options[1].total;
            return (
              <div key={id} style={s.betCard}>
                <div style={s.betBadge}>OUVERT</div>
                <div style={s.betTitle}>{bet.title}</div>
                <div style={s.barRow}>
                  {bet.options.map((o,i)=>{
                    const pct = total > 0 ? Math.round((o.total/total)*100) : 50;
                    return (
                      <div key={i} style={{flex:1}}>
                        <div style={{...s.bar, background: i===0?"#6366f1":"#ec4899", width:`${pct}%`}}/>
                        <div style={s.barLabel}>{o.label} — {pct}%</div>
                      </div>
                    );
                  })}
                </div>
                {myBet
                  ? <div style={s.myBetTag}>Tu as misé {CURRENCY}{myBet.amount} sur « {bet.options[myBet.option].label} »</div>
                  : <button style={s.btnPrimary} onClick={()=>openModal(id)}>Miser 🎯</button>
                }
              </div>
            );
          })}
        </div>
      )}

      {tab === "classement" && (
        <div style={s.section}>
          {sortedUsers.map(([name, u], i) => (
            <div key={name} style={{...s.rankRow, ...(name===pseudo?s.rankHighlight:{})}}>
              <span style={s.rankNum}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`}</span>
              <span style={s.rankName}>{name}{name===pseudo?" (toi)":""}</span>
              <span style={s.rankBal}>{CURRENCY}{u.balance}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "historique" && (
        <div style={s.section}>
          {closedBets.length === 0 && <div style={s.empty}>Aucun pari terminé pour l'instant</div>}
          {closedBets.map(([id, bet]) => {
            const myBet = bet.playerBets[pseudo];
            const won = myBet && myBet.option === bet.winner;
            return (
              <div key={id} style={{...s.betCard, opacity:0.85}}>
                <div style={{...s.betBadge, background:"#64748b"}}>TERMINÉ</div>
                <div style={s.betTitle}>{bet.title}</div>
                <div style={s.winnerTag}>🏆 Gagnant : {bet.options[bet.winner].label}</div>
                {myBet && (
                  <div style={{...s.myBetTag, background: won?"#dcfce7":"#fee2e2", color: won?"#166534":"#991b1b"}}>
                    {won ? `✅ Tu as gagné ! (misé ${CURRENCY}${myBet.amount})` : `❌ Perdu (misé ${CURRENCY}${myBet.amount} sur « ${bet.options[myBet.option].label} »)`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Toast({ toast }) {
  return (
    <div style={{
      position:"fixed", top:16, left:"50%", transform:"translateX(-50%)",
      background: toast.type==="err"?"#ef4444":"#1e293b",
      color:"#fff", padding:"10px 20px", borderRadius:12,
      fontSize:14, fontWeight:600, zIndex:9999, boxShadow:"0 4px 20px rgba(0,0,0,0.3)"
    }}>{toast.msg}</div>
  );
}

const s = {
  page: { minHeight:"100vh", background:"#0f172a", color:"#f1f5f9", fontFamily:"system-ui,sans-serif", padding:"0 0 40px" },
  loadBox: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:12 },
  loadTxt: { color:"#94a3b8", fontSize:16 },
  emoji: { fontSize:56, textAlign:"center", marginBottom:8 },
  card: { maxWidth:400, margin:"60px auto 0", background:"#1e293b", borderRadius:20, padding:28, display:"flex", flexDirection:"column", gap:12 },
  title: { textAlign:"center", fontSize:24, fontWeight:800, color:"#f8fafc" },
  sub: { textAlign:"center", fontSize:13, color:"#64748b", letterSpacing:2, textTransform:"uppercase" },
  divider: { borderTop:"1px solid #334155", margin:"4px 0" },
  input: { background:"#0f172a", border:"1px solid #334155", borderRadius:10, padding:"10px 14px", color:"#f1f5f9", fontSize:14, outline:"none", width:"100%", boxSizing:"border-box", marginBottom:0 },
  btnPrimary: { background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", border:"none", borderRadius:12, padding:"12px 0", fontSize:15, fontWeight:700, cursor:"pointer", width:"100%", marginTop:4 },
  btnSecondary: { background:"#334155", color:"#f1f5f9", border:"none", borderRadius:12, padding:"10px 16px", fontSize:14, fontWeight:600, cursor:"pointer" },
  btnBack: { background:"#1e293b", color:"#94a3b8", border:"1px solid #334155", borderRadius:10, padding:"6px 14px", fontSize:13, cursor:"pointer" },
  adminRow: { display:"flex", gap:8, alignItems:"center" },
  header: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 20px", background:"#1e293b", borderBottom:"1px solid #334155", position:"sticky", top:0, zIndex:10 },
  headerTitle: { fontSize:17, fontWeight:800, color:"#f8fafc" },
  headerSub: { fontSize:12, color:"#64748b", marginTop:2 },
  tabRow: { display:"flex", gap:4, padding:"12px 16px 0", background:"#1e293b", borderBottom:"1px solid #334155" },
  tabBtn: { flex:1, padding:"9px 0", background:"transparent", border:"none", color:"#64748b", fontSize:13, fontWeight:600, cursor:"pointer", borderRadius:"8px 8px 0 0" },
  tabActive: { background:"#0f172a", color:"#818cf8", borderBottom:"2px solid #818cf8" },
  section: { padding:"16px", display:"flex", flexDirection:"column", gap:12 },
  sectionTitle: { fontSize:14, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:1, marginBottom:4 },
  empty: { textAlign:"center", color:"#475569", fontSize:14, padding:"32px 0", lineHeight:1.8 },
  betCard: { background:"#1e293b", borderRadius:16, padding:16, display:"flex", flexDirection:"column", gap:10, position:"relative" },
  betBadge: { position:"absolute", top:12, right:12, background:"#22c55e", color:"#fff", fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20, letterSpacing:1 },
  betTitle: { fontSize:15, fontWeight:700, color:"#f1f5f9", paddingRight:60, lineHeight:1.4 },
  optRow: { display:"flex", gap:8 },
  optChip: { flex:1, background:"#0f172a", borderRadius:10, padding:"8px 12px", display:"flex", justifyContent:"space-between", fontSize:13 },
  optAmt: { color:"#818cf8", fontWeight:700 },
  barRow: { display:"flex", flexDirection:"column", gap:6 },
  bar: { height:6, borderRadius:3, minWidth:6, transition:"width 0.3s" },
  barLabel: { fontSize:12, color:"#94a3b8", marginTop:3 },
  myBetTag: { background:"#1e3a5f", color:"#93c5fd", borderRadius:10, padding:"8px 12px", fontSize:13, fontWeight:600 },
  winnerTag: { background:"#1c2e1c", color:"#86efac", borderRadius:10, padding:"8px 12px", fontSize:13, fontWeight:600 },
  row: { display:"flex", gap:8, alignItems:"center", marginBottom:8 },
  vs: { color:"#64748b", fontWeight:700, fontSize:13 },
  adminBtnRow: { display:"flex", gap:6, flexWrap:"wrap" },
  btnSmall: { color:"#fff", border:"none", borderRadius:8, padding:"6px 10px", fontSize:12, fontWeight:600, cursor:"pointer", flex:1 },
  rankRow: { display:"flex", alignItems:"center", gap:12, background:"#1e293b", borderRadius:12, padding:"12px 16px" },
  rankHighlight: { background:"#1e2d4a", borderLeft:"3px solid #6366f1" },
  rankNum: { fontSize:18, width:30, textAlign:"center" },
  rankName: { flex:1, fontWeight:600 },
  rankBal: { color:"#818cf8", fontWeight:700, fontSize:15 },
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:50, display:"flex", alignItems:"center", justifyContent:"center", padding:16 },
  modalCard: { background:"#1e293b", borderRadius:20, padding:20, width:"100%", maxWidth:380, display:"flex", flexDirection:"column", gap:10 },
  optBtnRow: { display:"flex", gap:8 },
  optBtn: { flex:1, background:"#0f172a", border:"2px solid #334155", color:"#f1f5f9", borderRadius:12, padding:"12px 8px", fontSize:13, fontWeight:600, cursor:"pointer", textAlign:"center", lineHeight:1.6 },
  optBtnSel: { border:"2px solid #6366f1", background:"#1e1b4b", color:"#818cf8" },
};