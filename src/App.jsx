import { useState, useEffect, useCallback } from "react";

const ADMIN_PASSWORDS = {
  "Seylitair93": "full", // Admin complet - tous les droits
  "augustinsti2d22": "betonly" // Admin partiel - créer les paris seulement
};
const START_BALANCE = 500;
const CURRENCY = "💰";
const WEEKLY_BONUS = 100; // Bonus du vendredi pour le 1er du classement

// Icônes disponibles pour les paris
const BET_ICONS = ["🎯", "⚽", "🏀", "🎮", "📚", "🍕", "☕", "🚗", "🎬", "🎵", "💻", "⚡", "🔥", "❄️", "🌙", "☀️", "🎓", "👨‍🏫", "👩‍🏫"];

export default function App() {
  const [screen, setScreen] = useState("login");
  const [pseudo, setPseudo] = useState("");
  const [inputPseudo, setInputPseudo] = useState("");
  const [adminInput, setAdminInput] = useState("");
  const [adminLevel, setAdminLevel] = useState(null);
  const [users, setUsers] = useState({});
  const [bets, setBets] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("paris");
  const [toast, setToast] = useState(null);
  const [showAdminInput, setShowAdminInput] = useState(false);

  // Admin form
  const [nTitle, setNTitle] = useState("");
  const [nOpt1, setNOpt1] = useState("");
  const [nOpt2, setNOpt2] = useState("");
  const [nIcon, setNIcon] = useState("🎯");
  const [nType, setNType] = useState("between"); // "prof", "eleve", "between"
  const [nTargetName, setNTargetName] = useState("");
  const [nMultiplier, setNMultiplier] = useState(1);
  const [nBonusOpt1, setNBonusOpt1] = useState(0);
  const [nBonusOpt2, setNBonusOpt2] = useState(0);

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
    if (!upd[p]) upd[p] = { balance: START_BALANCE, stats: { wins: 0, losses: 0, total: 0 } };
    await saveUsers(upd);
    setPseudo(p);
    setScreen("main");
  };

  const handleAdminLogin = () => {
    const level = ADMIN_PASSWORDS[adminInput];
    if (level) {
      setAdminLevel(level);
      setScreen("admin");
      setShowAdminInput(false);
      setAdminInput("");
      showToast(`Connecté en tant qu'admin (${level === "full" ? "Complet" : "Paris seulement"})`);
    } else {
      showToast("Mot de passe incorrect !", "err");
    }
  };

  // Distribuer le bonus du vendredi
  const distributeWeeklyBonus = async () => {
    const sorted = Object.entries(users).sort((a, b) => b[1].balance - a[1].balance);
    if (sorted.length === 0) return;
    
    const [topPlayer] = sorted[0];
    const upd = { ...users, [topPlayer]: { ...users[topPlayer], balance: users[topPlayer].balance + WEEKLY_BONUS } };
    await saveUsers(upd);
    showToast(`🏆 ${topPlayer} reçoit le bonus du vendredi ! (+${WEEKLY_BONUS} 💰)`);
  };

  const createBet = async () => {
    if (!nTitle || !nOpt1 || !nOpt2) return;
    const id = Date.now().toString();
    const description = nType === "prof" 
      ? `📚 À propos: Prof ${nTargetName}`
      : nType === "eleve"
      ? `👤 À propos: ${nTargetName}`
      : "🤝 Entre nous";
    
    const upd = {
      ...bets,
      [id]: {
        title: nTitle,
        icon: nIcon,
        description,
        type: nType,
        targetName: nTargetName,
        options: [
          { label: nOpt1, total: 0, bonus: nBonusOpt1 },
          { label: nOpt2, total: 0, bonus: nBonusOpt2 }
        ],
        multiplier: nMultiplier,
        status: "open",
        winner: null,
        playerBets: {},
        createdAt: Date.now()
      }
    };
    await saveBets(upd);
    setNTitle(""); setNOpt1(""); setNOpt2(""); setNIcon("🎯"); setNType("between"); setNTargetName("");
    setNMultiplier(1); setNBonusOpt1(0); setNBonusOpt2(0);
    showToast("Pari créé ✅");
  };

  const closeBet = async (betId, winnerIdx) => {
    const bet = bets[betId];
    const updUsers = { ...users };
    const totalPool = bet.options[0].total + bet.options[1].total;
    const winnerTotal = bet.options[winnerIdx].total;
    const winnerBonus = bet.options[winnerIdx].bonus || 0;

    Object.entries(bet.playerBets).forEach(([p, pb]) => {
      if (!updUsers[p]) updUsers[p] = { balance: START_BALANCE, stats: { wins: 0, losses: 0, total: 0 } };
      if (!updUsers[p].stats) updUsers[p].stats = { wins: 0, losses: 0, total: 0 };
      
      updUsers[p].stats.total = (updUsers[p].stats.total || 0) + 1;
      
      if (pb.option === winnerIdx && winnerTotal > 0) {
        const gain = Math.round((pb.amount / winnerTotal) * totalPool * bet.multiplier);
        const totalGain = gain + (winnerBonus * bet.multiplier);
        updUsers[p].balance += totalGain;
        updUsers[p].stats.wins = (updUsers[p].stats.wins || 0) + 1;
      } else {
        updUsers[p].stats.losses = (updUsers[p].stats.losses || 0) + 1;
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
        <div style={{...s.emoji, fontSize:56}}>🎰</div>
        <div style={s.title}>Paris de Classe</div>
        <div style={s.sub}>1STI2D2</div>
        <div style={s.divider} />
        <input style={s.input} placeholder="Ton pseudo..." value={inputPseudo}
          onChange={e => setInputPseudo(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()} />
        <button style={s.btnPrimary} onClick={handleLogin}>Rejoindre 🚀</button>
        <div style={s.divider} />
        <button style={{...s.btnSecondary, width: "100%"}} onClick={() => setShowAdminInput(!showAdminInput)}>
          {showAdminInput ? "✕ Fermer" : "🔐 Mode Admin"}
        </button>
        {showAdminInput && (
          <div style={s.adminInputBox}>
            <input style={{...s.input, marginBottom: 8}} type="password"
              placeholder="Mot de passe admin..." value={adminInput}
              onChange={e => setAdminInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdminLogin()} autoFocus />
            <button style={s.btnPrimary} onClick={handleAdminLogin}>Connexion Admin</button>
          </div>
        )}
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

      {adminLevel === "full" && (
        <div style={{...s.section, background: "#1a3a2a", borderRadius: 16}}>
          <button style={{...s.btnPrimary, background: "#10b981"}} onClick={distributeWeeklyBonus}>
            🏆 Distribuer bonus vendredi (+{WEEKLY_BONUS} 💰)
          </button>
        </div>
      )}

      <div style={s.section}>
        <div style={s.sectionTitle}>Créer un pari</div>
        
        <input style={s.input} placeholder="Question (ex: Kévin va dormir en cours ?)" 
          value={nTitle} onChange={e=>setNTitle(e.target.value)}/>

        <div style={{display: "flex", gap: 8}}>
          <div style={{flex: 1}}>
            <label style={s.label}>Icône du pari</label>
            <div style={s.iconGrid}>
              {BET_ICONS.map(icon => (
                <button key={icon}
                  style={{...s.iconBtn, ...(nIcon === icon ? s.iconBtnActive : {})}}
                  onClick={() => setNIcon(icon)}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={s.row}>
          <div style={{flex: 1}}>
            <label style={s.label}>Type de pari</label>
            <select style={s.select} value={nType} onChange={e => {setNType(e.target.value); setNTargetName("");}}>
              <option value="between">🤝 Entre nous</option>
              <option value="prof">📚 À propos d'un prof</option>
              <option value="eleve">👤 À propos d'un élève</option>
            </select>
          </div>
        </div>

        {nType !== "between" && (
          <input style={s.input} placeholder={nType === "prof" ? "Nom du prof..." : "Nom de l'élève..."}
            value={nTargetName} onChange={e => setNTargetName(e.target.value)} />
        )}

        <div style={s.row}>
          <input style={{...s.input, flex:1, marginBottom:0}} placeholder="Option A" 
            value={nOpt1} onChange={e=>setNOpt1(e.target.value)}/>
          <span style={s.vs}>VS</span>
          <input style={{...s.input, flex:1, marginBottom:0}} placeholder="Option B" 
            value={nOpt2} onChange={e=>setNOpt2(e.target.value)}/>
        </div>

        <div style={s.row}>
          <div style={{flex: 1}}>
            <label style={s.label}>Bonus Option A (💰)</label>
            <input style={s.input} type="number" placeholder="0" value={nBonusOpt1} 
              onChange={e=>setNBonusOpt1(parseInt(e.target.value) || 0)} />
          </div>
          <div style={{flex: 1}}>
            <label style={s.label}>Bonus Option B (💰)</label>
            <input style={s.input} type="number" placeholder="0" value={nBonusOpt2} 
              onChange={e=>setNBonusOpt2(parseInt(e.target.value) || 0)} />
          </div>
        </div>

        <div style={{flex: 1}}>
          <label style={s.label}>Multiplicateur de gains (×)</label>
          <select style={s.select} value={nMultiplier} onChange={e => setNMultiplier(parseFloat(e.target.value))}>
            <option value={1}>1× Normal</option>
            <option value={1.5}>1.5× Augmenté</option>
            <option value={2}>2× Double</option>
            <option value={2.5}>2.5× Mega</option>
            <option value={3}>3× ULTRA</option>
          </select>
        </div>

        <button style={s.btnPrimary} onClick={createBet}>Créer le pari ➕</button>
      </div>

      {adminLevel === "full" && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Paris ouverts</div>
          {openBets.length === 0 && <div style={s.empty}>Aucun pari ouvert</div>}
          {openBets.map(([id, bet]) => (
            <div key={id} style={s.betCard}>
              <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 8}}>
                <span style={{fontSize: 24}}>{bet.icon}</span>
                <div style={{flex: 1}}>
                  <div style={s.betTitle}>{bet.title}</div>
                  <div style={{fontSize: 12, color: "#94a3b8"}}>{bet.description}</div>
                  {bet.multiplier > 1 && <div style={{fontSize: 12, color: "#fbbf24"}}>×{bet.multiplier} Multiplicateur</div>}
                </div>
              </div>
              <div style={s.optRow}>
                {bet.options.map((o, i) => (
                  <div key={i} style={s.optChip}>
                    <div>
                      <span>{o.label}</span>
                      {o.bonus > 0 && <span style={{fontSize: 11, color: "#10b981"}}> +{o.bonus} 🎁</span>}
                    </div>
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
              <div style={{textAlign: "right"}}>
                <div style={s.rankBal}>{CURRENCY}{u.balance}</div>
                {u.stats && <div style={{fontSize: 11, color: "#94a3b8"}}>
                  {u.stats.wins || 0}W-{u.stats.losses || 0}L
                </div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // MAIN (player)
  const myBal = users[pseudo]?.balance ?? START_BALANCE;
  const myStats = users[pseudo]?.stats || { wins: 0, losses: 0, total: 0 };
  
  return (
    <div style={s.page}>
      {toast && <Toast toast={toast} />}
      {modal && (
        <div style={s.overlay} onClick={()=>setModal(null)}>
          <div style={s.modalCard} onClick={e=>e.stopPropagation()}>
            <div style={{display: "flex", alignItems: "center", gap: 12, marginBottom: 12}}>
              <span style={{fontSize: 28}}>{bets[modal]?.icon}</span>
              <div>
                <div style={s.betTitle}>{bets[modal]?.title}</div>
                <div style={{fontSize: 12, color: "#94a3b8"}}>{bets[modal]?.description}</div>
              </div>
            </div>
            {bets[modal]?.multiplier > 1 && (
              <div style={{background: "#1e1b4b", color: "#fbbf24", padding: 8, borderRadius: 8, marginBottom: 12, fontWeight: 600}}>
                🚀 Multiplicateur ×{bets[modal]?.multiplier}
              </div>
            )}
            <div style={s.optBtnRow}>
              {bets[modal]?.options.map((o,i)=>(
                <button key={i}
                  style={{...s.optBtn, ...(selOpt===i?s.optBtnSel:{})}}
                  onClick={()=>setSelOpt(i)}>
                  {o.label}
                  {o.bonus > 0 && <span style={{fontSize: 11, display: "block"}}>+{o.bonus} 🎁</span>}
                  <br/><span style={{fontSize:11,opacity:0.7}}>{CURRENCY}{o.total} misés</span>
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
          <div style={{fontSize: 11, color: "#64748b", marginTop: 4}}>
            {myStats.wins}W-{myStats.losses}L ({myStats.total} paris)
          </div>
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
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start"}}>
                  <div style={{display: "flex", gap: 8}}>
                    <span style={{fontSize: 24}}>{bet.icon}</span>
                    <div style={{flex: 1}}>
                      <div style={s.betTitle}>{bet.title}</div>
                      <div style={{fontSize: 12, color: "#94a3b8", marginBottom: 4}}>{bet.description}</div>
                    </div>
                  </div>
                  <div style={{display: "flex", gap: 4}}>
                    <div style={s.betBadge}>OUVERT</div>
                    {bet.multiplier > 1 && <div style={{...s.betBadge, background: "#f59e0b"}}>×{bet.multiplier}</div>}
                  </div>
                </div>
                <div style={s.barRow}>
                  {bet.options.map((o,i)=>{
                    const pct = total > 0 ? Math.round((o.total/total)*100) : 50;
                    return (
                      <div key={i} style={{flex:1}}>
                        <div style={{...s.bar, background: i===0?"#6366f1":"#ec4899", width:`${pct}%`}}/>
                        <div style={s.barLabel}>
                          {o.label} — {pct}%
                          {o.bonus > 0 && <span style={{color: "#10b981"}}> +{o.bonus} 🎁</span>}
                        </div>
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
              <div style={{textAlign: "right"}}>
                <div style={s.rankBal}>{CURRENCY}{u.balance}</div>
                {u.stats && <div style={{fontSize: 10, color: "#94a3b8"}}>
                  {u.stats.wins || 0}W-{u.stats.losses || 0}L
                </div>}
              </div>
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
                <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 8}}>
                  <span style={{fontSize: 20}}>{bet.icon}</span>
                  <div style={{flex: 1}}>
                    <div style={s.betTitle}>{bet.title}</div>
                    <div style={{fontSize: 11, color: "#94a3b8"}}>{bet.description}</div>
                  </div>
                  <div style={s.betBadge}>TERMINÉ</div>
                </div>
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
  page: { minHeight:"100vh", background:"linear-gradient(135deg, #0f172a 0%, #1a1f35 100%)", color:"#f1f5f9", fontFamily:"system-ui,sans-serif", padding:"0 0 40px" },
  loadBox: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:12 },
  loadTxt: { color:"#94a3b8", fontSize:16 },
  emoji: { fontSize:56, textAlign:"center", marginBottom:8 },
  card: { maxWidth:400, margin:"40px auto 0", background:"#1e293b", borderRadius:20, padding:28, display:"flex", flexDirection:"column", gap:12, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" },
  title: { textAlign:"center", fontSize:28, fontWeight:800, color:"#f8fafc" },
  sub: { textAlign:"center", fontSize:13, color:"#64748b", letterSpacing:2, textTransform:"uppercase" },
  divider: { borderTop:"1px solid #334155", margin:"4px 0" },
  adminInputBox: { background: "#0f172a", padding: 16, borderRadius: 12, border: "1px solid #334155", marginTop: 8 },
  input: { background:"#0f172a", border:"1px solid #334155", borderRadius:10, padding:"10px 14px", color:"#f1f5f9", fontSize:14, outline:"none", width:"100%", boxSizing:"border-box", marginBottom:8 },
  select: { background:"#0f172a", border:"1px solid #334155", borderRadius:10, padding:"10px 14px", color:"#f1f5f9", fontSize:14, outline:"none", width:"100%", boxSizing:"border-box", marginBottom:8, cursor: "pointer" },
  label: { display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4, fontWeight: 600 },
  btnPrimary: { background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", border:"none", borderRadius:12, padding:"12px 0", fontSize:15, fontWeight:700, cursor:"pointer", width:"100%", marginTop:4 },
  btnSecondary: { background:"#334155", color:"#f1f5f9", border:"none", borderRadius:12, padding:"10px 16px", fontSize:14, fontWeight:600, cursor:"pointer" },
  btnBack: { background:"#1e293b", color:"#94a3b8", border:"1px solid #334155", borderRadius:10, padding:"6px 14px", fontSize:13, cursor:"pointer" },
  header: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 20px", background:"#1e293b", borderBottom:"1px solid #334155", position:"sticky", top:0, zIndex:10 },
  headerTitle: { fontSize:17, fontWeight:800, color:"#f8fafc" },
  headerSub: { fontSize:12, color:"#64748b", marginTop:2 },
  tabRow: { display:"flex", gap:4, padding:"12px 16px 0", background:"#1e293b", borderBottom:"1px solid #334155" },
  tabBtn: { flex:1, padding:"9px 0", background:"transparent", border:"none", color:"#64748b", fontSize:13, fontWeight:600, cursor:"pointer", borderRadius:"8px 8px 0 0" },
  tabActive: { background:"#0f172a", color:"#818cf8", borderBottom:"2px solid #818cf8" },
  section: { padding:"16px", display:"flex", flexDirection:"column", gap:12 },
  sectionTitle: { fontSize:14, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:1, marginBottom:4 },
  empty: { textAlign:"center", color:"#475569", fontSize:14, padding:"32px 0", lineHeight:1.8 },
  betCard: { background:"#1e293b", borderRadius:16, padding:16, display:"flex", flexDirection:"column", gap:10, position:"relative", border: "1px solid #334155", transition: "all 0.2s" },
  betBadge: { background:"#22c55e", color:"#fff", fontSize:10, fontWeight:700, padding:"4px 10px", borderRadius:20, letterSpacing:1 },
  betTitle: { fontSize:15, fontWeight:700, color:"#f1f5f9", lineHeight:1.4 },
  optRow: { display:"flex", gap:8 },
  optChip: { flex:1, background:"#0f172a", borderRadius:10, padding:"8px 12px", display:"flex", justifyContent:"space-between", fontSize:13, border: "1px solid #334155" },
  optAmt: { color:"#818cf8", fontWeight:700 },
  barRow: { display:"flex", flexDirection:"column", gap:6 },
  bar: { height:6, borderRadius:3, minWidth:6, transition:"width 0.3s" },
  barLabel: { fontSize:12, color:"#94a3b8", marginTop:3 },
  myBetTag: { background:"#1e3a5f", color:"#93c5fd", borderRadius:10, padding:"8px 12px", fontSize:13, fontWeight:600 },
  winnerTag: { background:"#1c2e1c", color:"#86efac", borderRadius:10, padding:"8px 12px", fontSize:13, fontWeight:600 },
  row: { display:"flex", gap:8, alignItems:"flex-end", marginBottom:8 },
  vs: { color:"#64748b", fontWeight:700, fontSize:13 },
  adminBtnRow: { display:"flex", gap:6, flexWrap:"wrap" },
  btnSmall: { color:"#fff", border:"none", borderRadius:8, padding:"6px 10px", fontSize:12, fontWeight:600, cursor:"pointer", flex:1 },
  rankRow: { display:"flex", alignItems:"center", gap:12, background:"#1e293b", borderRadius:12, padding:"12px 16px", border: "1px solid #334155" },
  rankHighlight: { background:"#1e2d4a", borderLeft:"3px solid #6366f1" },
  rankNum: { fontSize:18, width:30, textAlign:"center" },
  rankName: { flex:1, fontWeight:600 },
  rankBal: { color:"#818cf8", fontWeight:700, fontSize:15 },
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:50, display:"flex", alignItems:"center", justifyContent:"center", padding:16 },
  modalCard: { background:"#1e293b", borderRadius:20, padding:20, width:"100%", maxWidth:380, display:"flex", flexDirection:"column", gap:10, border: "1px solid #334155" },
  optBtnRow: { display:"flex", gap:8 },
  optBtn: { flex:1, background:"#0f172a", border:"2px solid #334155", color:"#f1f5f9", borderRadius:12, padding:"12px 8px", fontSize:13, fontWeight:600, cursor:"pointer", textAlign:"center", lineHeight:1.6 },
  optBtnSel: { border:"2px solid #6366f1", background:"#1e1b4b", color:"#818cf8" },
  iconGrid: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 },
  iconBtn: { background: "#0f172a", border: "2px solid #334155", borderRadius: 8, padding: 8, fontSize: 20, cursor: "pointer", transition: "all 0.2s" },
  iconBtnActive: { border: "2px solid #6366f1", background: "#1e1b4b" },
};
