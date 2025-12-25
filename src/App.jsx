import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, RefreshCcw, Mail, Settings, TrendingUp, FileText, X, AlertCircle,
  ChevronRight, Globe, BarChart3, Calendar, Download, Clock, ArrowUpRight,
  ArrowDownRight, Search, ExternalLink, LineChart, Loader2
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, onSnapshot, addDoc, deleteDoc, query } from 'firebase/firestore';
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

  // 1. 익명 로그인
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
      else signInAnonymously(auth).catch(() => setStatusMsg("로그인 실패"));
    });
    return () => unsubscribe();
  }, []);

  // 2. 데이터 실시간 감시 (사용자 개인 경로)
  useEffect(() => {
    if (!user?.uid) return;

    const kwRef = collection(db, 'artifacts', appId, 'users', user.uid, 'keywords');
    const unsubKw = onSnapshot(kwRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const sorted = list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setKeywords(sorted);
      
      // 데이터가 없으면 샘플 추가
      if (snap.empty) {
        ["산업은행", "삼성전자", "반도체"].forEach(n => {
          addDoc(kwRef, { name: n, createdAt: Date.now() });
        });
      }
    });

    const tkRef = collection(db, 'artifacts', appId, 'users', user.uid, 'tickers');
    const unsubTk = onSnapshot(tkRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTickers(list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      if (snap.empty) {
        const defaults = [
          { name: 'KOSPI', symbol: '^KS11', unit: 'p' },
          { name: 'KOSDAQ', symbol: '^KQ11', unit: 'p' },
          { name: 'USD/KRW', symbol: 'KRW=X', unit: '원' }
        ];
        defaults.forEach(t => addDoc(tkRef, { ...t, createdAt: Date.now() }));
      }
    });

    return () => { unsubKw(); unsubTk(); };
  }, [user]);

  // 마켓 티커 데이터 페칭
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
            let formattedPrice = curPrice.toLocaleString(undefined, { maximumFractionDigits: 2 });
            let formattedDiff = Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 2 });
            return { name: t.name, price: formattedPrice, unit: t.unit, diff: formattedDiff, pct: `${diff >= 0 ? '+' : ''}${pct}%`, isUp: diff >= 0 };
          }
        } catch (e) { return null; }
      }));
      setMarketData(results.filter(m => m !== null));
    } catch (err) {}
  };

  useEffect(() => { fetchMarketTicker(); }, [tickers]);

  // 뉴스 검색 로직 (안정성 강화)
  const searchNews = async () => {
    // 리스트가 비어있으면 중단
    if (!keywords || keywords.length === 0) {
      setStatusMsg("키워드를 먼저 추가해주세요.");
      return;
    }

    setIsSearching(true);
    setStatusMsg(`${lookback}일간 뉴스 수집 중...`);
    
    try {
      const results = [];
      // 비동기 루프를 순차적으로 실행하여 누락 방지
      for (const kw of keywords) {
        const queryStr = `${kw.name} when:${lookback}d`;
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(queryStr)}&hl=ko&gl=KR&ceid=KR:ko`;
        const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data && data.items) {
          results.push({
            name: kw.name,
            query: queryStr,
            articles: data.items.slice(0, 4).map(item => {
              const splitTitle = item.title.split(' - ');
              const rawDate = new Date(item.pubDate);
              const formattedDate = `${rawDate.getFullYear()}.${String(rawDate.getMonth() + 1).padStart(2, '0')}.${String(rawDate.getDate()).padStart(2, '0')} ${String(rawDate.getHours()).padStart(2, '0')}:${String(rawDate.getMinutes()).padStart(2, '0')}`;
              return { title: splitTitle[0], link: item.link, source: splitTitle[1] || "뉴스", date: formattedDate };
            }),
          });
        }
      }
      setReport(results);
      setStatusMsg(results.length > 0 ? "수집 완료!" : "검색 결과가 없습니다.");
    } catch (err) {
      setStatusMsg("검색 중 오류 발생");
    } finally {
      setIsSearching(false);
      setTimeout(() => setStatusMsg(""), 2000);
    }
  };

  const addKeywordAction = async (e) => {
    e.preventDefault();
    if (!newKeyword.trim() || !user?.uid) return;
    try {
      const kwRef = collection(db, 'artifacts', appId, 'users', user.uid, 'keywords');
      await addDoc(kwRef, { name: newKeyword.trim(), createdAt: Date.now() });
      setNewKeyword("");
    } catch (err) { setStatusMsg("추가 실패"); }
  };

  const deleteKeyword = async (id) => {
    if (!user?.uid) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'keywords', id));
  };

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
      if (data?.chart?.result?.[0]?.meta) {
        const meta = data.chart.result[0].meta;
        const resolvedName = meta.shortName || meta.fullExchangeName || symbol;
        let unit = (symbol.includes('.KS') || symbol.includes('.KQ') || symbol === 'KRW=X') ? '원' : 'USD';
        if (symbol.startsWith('^')) unit = 'p';
        const tkRef = collection(db, 'artifacts', appId, 'users', user.uid, 'tickers');
        await addDoc(tkRef, { name: resolvedName, symbol, unit, createdAt: Date.now() });
        setNewTickerSymbol(""); setStatusMsg(`${resolvedName} 추가`);
      }
    } catch (err) { setStatusMsg("심볼 오류"); }
    finally { setIsAddingTicker(false); setTimeout(() => setStatusMsg(""), 2000); }
  };

  const deleteTicker = async (id) => {
    if (!user?.uid) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tickers', id));
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] font-sans text-slate-900 pb-10">
      <section className="bg-[#0F172A] text-white overflow-hidden h-8 flex items-center sticky top-0 z-50 shadow-md">
        <div className="flex whitespace-nowrap animate-marquee">
          {marketData.concat(marketData).map((m, idx) => (
            <div key={idx} className="flex items-center gap-2 px-5 border-r border-slate-700/50">
              <span className="text-[10px] font-bold text-slate-400 uppercase">{m.name}</span>
              <span className="text-xs font-black">{m.price}<span className="text-[9px] ml-0.5 opacity-40">{m.unit}</span></span>
              <span className={`text-[10px] font-bold ${m.isUp ? 'text-rose-500' : 'text-blue-500'}`}>{m.isUp ? '▲' : '▼'}{m.diff}</span>
            </div>
          ))}
          {marketData.length === 0 && <span className="text-xs text-slate-500 px-4">Loading Market...</span>}
        </div>
      </section>

      <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-8 z-40 shadow-sm">
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
              <select value={lookback} onChange={(e) => setLookback(Number(e.target.value))} className="bg-transparent text-[10px] font-bold outline-none">
                <option value={2}>2일</option><option value={7}>1주</option><option value={30}>1달</option>
              </select>
            </div>
          </div>
          <form onSubmit={addKeywordAction} className="flex gap-1.5">
            <input type="text" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} placeholder="키워드 추가" className="flex-1 bg-slate-50 border rounded-lg px-3 py-2 text-[13px] font-bold outline-none focus:border-teal-500 shadow-inner" />
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
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {report.map((res, idx) => {
              const theme = THEME_COLORS[idx % THEME_COLORS.length];
              return (
                <div key={idx} className={`bg-white rounded-xl border-t-4 ${theme.border} p-3 shadow-sm`}>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className={`font-black text-[15px] ${theme.text}`}>{res.name}</h3>
                    <a href={`https://news.google.com/search?q=${encodeURIComponent(res.query)}`} target="_blank" rel="noreferrer" className={`text-[10px] font-bold ${theme.text} ${theme.bg} px-2 py-1 rounded-md`}>더보기</a>
                  </div>
                  <div className="space-y-2">
                    {res.articles.map((art, aIdx) => (
                      <a key={aIdx} href={art.link} target="_blank" rel="noreferrer" className="block p-2 rounded-lg bg-slate-50 active:bg-slate-100 border transition-colors hover:border-teal-200 group">
                        <p className="text-[13px] font-bold text-slate-800 leading-normal mb-2 group-hover:text-teal-700 line-clamp-2">{art.title}</p>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="font-black px-1.5 py-0.5 rounded-md border bg-slate-100 text-slate-600">{art.source}</span>
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
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-lg text-slate-900">티커 관리</h3>
              <button onClick={() => setShowTickerMgr(false)} className="text-slate-400"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <form onSubmit={addTickerAction} className="flex gap-2">
                <input type="text" value={newTickerSymbol} onChange={e=>setNewTickerSymbol(e.target.value)} placeholder="심볼(예: NVDA)" className="flex-1 bg-slate-50 border rounded-xl px-4 py-3 text-sm font-bold uppercase" disabled={isAddingTicker} />
                <button type="submit" className="bg-teal-600 text-white px-5 rounded-xl font-black disabled:opacity-50" disabled={isAddingTicker || !newTickerSymbol.trim()}>추가</button>
              </form>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {tickers.map(tk => (
                  <div key={tk.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border">
                    <div className="flex flex-col"><span className="text-xs font-black">{tk.name}</span><span className="text-[10px] text-slate-400">{tk.symbol}</span></div>
                    <button onClick={() => deleteTicker(tk.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {statusMsg && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-xl z-[100] text-sm whitespace-nowrap animate-bounce">{statusMsg}</div>}

      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } } 
        .animate-marquee { display: flex; animation: marquee 50s linear infinite; }
        .animate-marquee:hover { animation-play-state: paused; }
      `}</style>
    </div>
  );
}