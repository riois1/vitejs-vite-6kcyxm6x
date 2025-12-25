import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, RefreshCcw, Mail, Settings, TrendingUp, FileText, X, AlertCircle,
  ChevronRight, Globe, BarChart3, Calendar, Download, Clock, ArrowUpRight,
  ArrowDownRight, Search, ExternalLink, LineChart, Loader2
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, onSnapshot, addDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyBZW2aYSpge5WhB1MnjB_dcxL2zlTbylEs",
  authDomain: "kwnb-292e4.firebaseapp.com",
  projectId: "kwnb-292e4",
  storageBucket: "kwnb-292e4.firebasestorage.app",
  messagingSenderId: "334663791620",
  appId: "1:334663791620:web:0d4a1d22f7e688f9737151",
  measurementId: "G-XW9D8KSTG9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'keyword-newsbot-v6';

const THEME_COLORS = [
  { border: 'border-t-teal-500', text: 'text-teal-600', bg: 'bg-teal-50' },
  { border: 'border-t-blue-500', text: 'text-blue-600', bg: 'bg-blue-50' },
  { border: 'border-t-indigo-500', text: 'text-indigo-600', bg: 'bg-indigo-50' },
  { border: 'border-t-rose-500', text: 'text-rose-600', bg: 'bg-rose-50' },
  { border: 'border-t-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [keywords, setKeywords] = useState([]); 
  const [tickers, setTickers] = useState([]); 
  const [newKeyword, setNewKeyword] = useState(""); 
  const [newTickerSymbol, setNewTickerSymbol] = useState("");
  const [isAddingTicker, setIsAddingTicker] = useState(false);
  const [marketData, setMarketData] = useState([]); 
  const [report, setReport] = useState(null); 
  const [isSearching, setIsSearching] = useState(false); 
  const [statusMsg, setStatusMsg] = useState(""); 
  const [lookback, setLookback] = useState(2); 
  const [showTickerMgr, setShowTickerMgr] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
      else signInAnonymously(auth).catch(() => setStatusMsg("로그인 실패"));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    // 설정 로드
    const settingsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'settings');
    getDoc(settingsRef).then(docSnap => {
      if (docSnap.exists()) setLookback(docSnap.data().lookback || 2);
    });

    // 키워드 로드
    const kwRef = collection(db, 'artifacts', appId, 'users', user.uid, 'keywords');
    const unsubKw = onSnapshot(kwRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setKeywords(list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      if (snap.empty) {
        ["산업은행", "삼성전자", "반도체"].forEach(n => addDoc(kwRef, { name: n, createdAt: Date.now() }));
      }
    });

    // 티커 로드
    const tkRef = collection(db, 'artifacts', appId, 'users', user.uid, 'tickers');
    const unsubTk = onSnapshot(tkRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTickers(list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    });

    return () => { unsubKw(); unsubTk(); };
  }, [user]);

  const handleLookbackChange = async (val) => {
    const numVal = Number(val);
    setLookback(numVal);
    if (user?.uid) {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'settings'), { lookback: numVal }, { merge: true });
    }
  };

  // [기존 티커 로직으로 복원]
  const fetchMarketTicker = async () => {
    if (tickers.length === 0) return;
    try {
      const results = await Promise.all(tickers.map(async (t) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${t.symbol}?interval=1d&range=5d`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        try {
          const res = await fetch(proxyUrl);
          const rawData = await res.json();
          const data = JSON.parse(rawData.contents);
          if (data?.chart?.result?.[0]) {
            const meta = data.chart.result[0].meta;
            const closes = data.chart.result[0].indicators?.quote?.[0]?.close?.filter(v => v !== null) || [];
            const curPrice = meta.regularMarketPrice || closes[closes.length - 1];
            const prevPrice = meta.previousClose || closes[closes.length - 2];
            const diff = curPrice - prevPrice;
            const pct = ((diff / prevPrice) * 100).toFixed(2);
            
            let formattedPrice, formattedDiff;
            if (t.unit === '원') {
              formattedPrice = Math.round(curPrice).toLocaleString();
              formattedDiff = Math.round(Math.abs(diff)).toLocaleString();
            } else if (t.unit === 'USD') {
              formattedPrice = curPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
              formattedDiff = Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
            } else {
              formattedPrice = curPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              formattedDiff = Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }

            return { 
              name: t.name, price: formattedPrice, unit: t.unit, diff: formattedDiff, 
              pct: `${diff >= 0 ? '+' : ''}${pct}%`, isUp: diff >= 0 
            };
          }
        } catch (e) { return null; }
      }));
      setMarketData(results.filter(m => m !== null));
    } catch (err) {}
  };

  useEffect(() => { fetchMarketTicker(); }, [tickers]);

  const searchNews = async () => {
    if (keywords.length === 0) return;
    setIsSearching(true);
    setStatusMsg("뉴스 수집 중...");
    try {
      const results = [];
      // 기간 파라미터 교정 (1m -> 30d로 변경하여 검색 정확도 향상)
      const period = lookback === 30 ? '30d' : (lookback === 365 ? '1y' : `${lookback}d`);

      for (const kw of keywords) {
        const queryStr = `${kw.name} when:${period}`;
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(queryStr)}&hl=ko&gl=KR&ceid=KR:ko`;
        const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        if (data.items) {
          results.push({
            name: kw.name, query: queryStr,
            articles: data.items.slice(0, 4).map(item => {
              const splitTitle = item.title.split(' - ');
              return { title: splitTitle[0], link: item.link, source: splitTitle[1] || "뉴스", date: item.pubDate };
            }),
          });
        }
      }
      setReport(results);
      setStatusMsg("수집 완료");
    } catch (err) { setStatusMsg("오류 발생"); }
    finally { setIsSearching(false); setTimeout(() => setStatusMsg(""), 2000); }
  };

  const addKeywordAction = async (e) => {
    e.preventDefault();
    if (!newKeyword.trim() || !user?.uid) return;
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'keywords'), { name: newKeyword.trim(), createdAt: Date.now() });
    setNewKeyword("");
  };

  const deleteKeyword = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'keywords', id));
  };

  // [기존 티커 추가 로직으로 복원]
  const addTickerAction = async (e) => {
    e.preventDefault();
    if (!newTickerSymbol.trim() || isAddingTicker || !user?.uid) return;
    setIsAddingTicker(true);
    const symbol = newTickerSymbol.trim().toUpperCase();
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      const data = JSON.parse((await res.json()).contents);
      if (data?.chart?.result?.[0]) {
        const meta = data.chart.result[0].meta;
        const resolvedName = meta.shortName || meta.fullExchangeName || symbol;
        let unit = 'USD';
        if (symbol.includes('.KS') || symbol.includes('.KQ') || symbol === 'KRW=X') unit = '원';
        else if (symbol.startsWith('^')) unit = 'p';
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'tickers'), { name: resolvedName, symbol, unit, createdAt: Date.now() });
        setNewTickerSymbol("");
      }
    } catch (err) { setStatusMsg("심볼 오류"); }
    finally { setIsAddingTicker(false); }
  };

  const deleteTicker = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tickers', id));
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] font-sans text-slate-900 pb-10">
      <section className="bg-[#0F172A] text-white overflow-hidden h-8 flex items-center sticky top-0 z-50">
        <div className="flex whitespace-nowrap animate-marquee">
          {marketData.concat(marketData).map((m, idx) => (
            <div key={idx} className="flex items-center gap-2 px-5 border-r border-slate-700/50">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{m.name}</span>
              <span className="text-xs font-black">{m.price}<span className="text-[9px] ml-0.5 opacity-40 font-normal">{m.unit}</span></span>
              <span className={`text-[10px] font-bold flex items-center gap-0.5 ${m.isUp ? 'text-rose-500' : 'text-blue-500'}`}>{m.isUp ? '▲' : '▼'}{m.diff}</span>
            </div>
          ))}
        </div>
      </section>

      <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-8 z-40">
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 p-1.5 rounded-lg"><Globe size={18} className="text-teal-400" /></div>
          <div>
            <h1 className="text-[18px] font-black tracking-tighter text-slate-900 leading-none">KeyWord NewsBot</h1>
            <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Intelligence Monitor v6.8</p>
          </div>
        </div>
        <button onClick={() => setShowTickerMgr(true)} className="p-2 text-slate-400 hover:text-teal-600 transition-all"><LineChart size={20} /></button>
      </header>

      <main className="p-3 space-y-3 max-w-2xl mx-auto">
        <section className="bg-white rounded-xl shadow-sm border p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-black flex items-center gap-2"><Search size={18} className="text-teal-500"/> Keyword</h2>
            <div className="flex items-center bg-slate-100 rounded-full px-2 py-0.5 border">
              <span className="text-[9px] font-bold text-slate-400 mr-1.5">PERIOD</span>
              <select value={lookback} onChange={(e) => handleLookbackChange(e.target.value)} className="bg-transparent text-[10px] font-bold outline-none">
                <option value={2}>2일</option>
                <option value={7}>1주</option>
                <option value={30}>1달</option>
                <option value={365}>1년</option>
              </select>
            </div>
          </div>
          <form onSubmit={addKeywordAction} className="flex gap-1.5">
            <input type="text" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} placeholder="키워드 추가" className="flex-1 bg-slate-50 border rounded-lg px-3 py-2 text-[13px] font-bold outline-none shadow-inner" />
            <button type="submit" className="bg-slate-900 text-white p-3 rounded-lg active:scale-95 transition-all shrink-0"><Plus size={20} /></button>
            <button type="button" onClick={searchNews} disabled={isSearching || keywords.length === 0} className="bg-teal-500 text-white px-8 py-2 rounded-lg font-black text-[15px] shadow-sm active:scale-95 transition-all flex items-center gap-1.5 shrink-0">
              {isSearching ? <RefreshCcw size={14} className="animate-spin" /> : <FileText size={14} />} 검색
            </button>
          </form>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {keywords.map((kw) => (
              <div key={kw.id} className="bg-slate-50 border pl-2 pr-1 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                {kw.name}<button onClick={() => deleteKeyword(kw.id)} className="text-slate-400 hover:text-rose-500"><X size={14} /></button>
              </div>
            ))}
          </div>
        </section>

        {report && (
          <div className="space-y-3">
            {report.map((res, idx) => {
              const theme = THEME_COLORS[idx % THEME_COLORS.length];
              return (
                <div key={idx} className={`bg-white rounded-xl border-t-4 ${theme.border} p-3 shadow-sm animate-in fade-in slide-in-from-bottom-2`}>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className={`font-black text-[15px] ${theme.text}`}>{res.name}</h3>
                    <a href={`https://news.google.com/search?q=${encodeURIComponent(res.query)}`} target="_blank" rel="noreferrer" className={`text-[10px] font-bold ${theme.text} ${theme.bg} px-2 py-1 rounded-md`}>더보기</a>
                  </div>
                  <div className="space-y-2">
                    {res.articles.map((art, aIdx) => (
                      <a key={aIdx} href={art.link} target="_blank" rel="noreferrer" className="block p-2 rounded-lg bg-slate-50 active:bg-slate-100 border transition-colors group">
                        <p className="text-[13px] font-bold text-slate-800 leading-normal mb-2 group-hover:text-teal-700 line-clamp-2">{art.title}</p>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="font-black px-1.5 py-0.5 rounded-md border bg-slate-100 text-slate-600 border-slate-200">{art.source}</span>
                          <span className="font-bold text-slate-400">{art.date}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showTickerMgr && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-lg text-slate-900">티커 관리</h3>
              <button onClick={() => setShowTickerMgr(false)} className="text-slate-400"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <form onSubmit={addTickerAction} className="flex gap-2">
                <input type="text" value={newTickerSymbol} onChange={e=>setNewTickerSymbol(e.target.value)} placeholder="심볼(예: NVDA, 005930.KS)" className="flex-1 bg-slate-50 border rounded-xl px-4 py-3 text-sm font-bold uppercase outline-none focus:border-teal-500 shadow-inner" disabled={isAddingTicker} />
                <button type="submit" className="bg-teal-600 text-white px-5 rounded-xl font-black shadow-md" disabled={isAddingTicker || !newTickerSymbol.trim()}>{isAddingTicker ? <Loader2 className="animate-spin" size={18} /> : "추가"}</button>
              </form>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {tickers.map(tk => (
                  <div key={tk.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex flex-col"><span className="text-xs font-black text-slate-800">{tk.name}</span><span className="text-[10px] text-slate-400">{tk.symbol}</span></div>
                    <button onClick={() => deleteTicker(tk.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {statusMsg && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-xl z-[100] text-sm animate-bounce">{statusMsg}</div>}

      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } } 
        .animate-marquee { display: flex; animation: marquee 50s linear infinite; }
      `}</style>
    </div>
  );
}