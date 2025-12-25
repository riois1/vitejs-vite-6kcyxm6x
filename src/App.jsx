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

// 뉴스 박스 테마 색상 (키워드별 가독성 향상용)
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
      else signInAnonymously(auth);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return; // 사용자 로그인 전에는 실행하지 않음

    // [개인화] public 대신 users/uid 경로 사용
    const kwRef = collection(db, 'artifacts', appId, 'users', user.uid, 'keywords');
    const unsubKw = onSnapshot(kwRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setKeywords(list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      if (list.length === 0) {
        ["산업은행", "삼성전자", "반도체"].forEach(n => addDoc(kwRef, { name: n, createdAt: Date.now() }));
      }
    });

    // [개인화] public 대신 users/uid 경로 사용
    const tkRef = collection(db, 'artifacts', appId, 'users', user.uid, 'tickers');
    const unsubTk = onSnapshot(tkRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTickers(list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      if (list.length === 0) {
          const defaults = [
            { name: 'KOSPI', symbol: '^KS11', unit: 'p' },
            { name: 'KOSDAQ', symbol: '^KQ11', unit: 'p' },
            { name: 'USD/KRW', symbol: 'KRW=X', unit: '원' },
            { name: 'NASDAQ', symbol: '^IXIC', unit: 'p' },
            { name: 'S&P 500', symbol: '^GSPC', unit: 'p' },
            { name: '삼성전자', symbol: '005930.KS', unit: '원' },
            { name: 'Nvidia', symbol: 'NVDA', unit: 'USD' }
          ];
          defaults.forEach(t => addDoc(tkRef, { ...t, createdAt: Date.now() }));
        }
    });

    return () => { unsubKw(); unsubTk(); };
  }, [user]); // user 상태가 변경될 때마다(로그인 시) 실행

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
              name: t.name, 
              price: formattedPrice, 
              unit: t.unit, 
              diff: formattedDiff, 
              pct: `${diff >= 0 ? '+' : ''}${pct}%`, 
              isUp: diff >= 0 
            };
          }
        } catch (e) { return { name: t.name, price: '-', unit: t.unit }; }
      }));
      setMarketData(results.filter(m => m && m.price !== '-'));
    } catch (err) {}
  };

  useEffect(() => { fetchMarketTicker(); }, [tickers]);

  const searchNews = async () => {
    if (keywords.length === 0) return;
    setIsSearching(true);
    setStatusMsg(`${lookback}일간 뉴스 수집 중...`);
    try {
      const results = [];
      for (const kw of keywords) {
        const queryStr = `${kw.name} when:${lookback}d`;
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(queryStr)}&hl=ko&gl=KR&ceid=KR:ko`;
        const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        if (data.items) {
          results.push({
            name: kw.name, query: queryStr,
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
      setStatusMsg("수집 완료!");
      setTimeout(() => setStatusMsg(""), 2000);
    } catch (err) { setStatusMsg("오류 발생"); }
    finally { setIsSearching(false); }
  };

  const addKeywordAction = async (e) => {
    e.preventDefault();
    if (!newKeyword.trim() || !user) return;
    try {
      // [개인화 경로 적용]
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'keywords'), { name: newKeyword.trim(), createdAt: Date.now() });
      setNewKeyword("");
    } catch (err) { setStatusMsg("추가 실패"); }
  };
  
  const deleteKeyword = async (id) => { 
    if (!user) return;
    // [개인화 경로 적용]
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'keywords', id)); 
  };

  const addTickerAction = async (e) => {
    e.preventDefault();
    if (!newTickerSymbol.trim() || isAddingTicker || !user) return;
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
        let unit = 'USD';
        if (symbol.includes('.KS') || symbol.includes('.KQ') || symbol === 'KRW=X') unit = '원';
        else if (symbol.startsWith('^')) unit = 'p';
        // [개인화 경로 적용]
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'tickers'), { name: resolvedName, symbol, unit, createdAt: Date.now() });
        setNewTickerSymbol(""); setStatusMsg(`${resolvedName} 추가 완료`);
      } else { setStatusMsg("유효하지 않은 심볼"); }
    } catch (err) { setStatusMsg("심볼 확인 오류"); }
    finally { setIsAddingTicker(false); setTimeout(() => setStatusMsg(""), 3000); }
  };
  
  const deleteTicker = async (id) => { 
    if (!user) return;
    // [개인화 경로 적용]
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tickers', id)); 
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] font-sans text-slate-900 pb-20">
      
      {/* 티커 바 */}
      <section className="bg-[#0F172A] text-white overflow-hidden h-8 flex items-center sticky top-0 z-50 shadow-md">
        <div className="flex whitespace-nowrap animate-marquee">
          {[...marketData, ...marketData].map((m, idx) => (
            <div key={idx} className="flex items-center gap-2 px-5 border-r border-slate-700/50">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{m.name}</span>
              <span className="text-xs font-black">
                {m.price}
                {m.unit !== 'p' && <span className="text-[9px] ml-0.5 opacity-40 font-normal">{m.unit}</span>}
              </span>
              <span className={`text-[10px] font-bold flex items-center gap-0.5 ${m.isUp ? 'text-rose-500' : 'text-blue-500'}`}>
                {m.isUp ? '▲' : '▼'}{m.diff}
                <span className="text-[9px] opacity-70 ml-0.5">({m.pct})</span>
              </span>
            </div>
          ))}
          {marketData.length === 0 && <span className="text-xs text-slate-500 px-4 tracking-widest uppercase">Initializing Ticker...</span>}
        </div>
      </section>

      {/* 헤더 */}
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-8 z-40 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 p-1.5 rounded-lg"><Globe size={18} className="text-teal-400" /></div>
          <div>
            <h1 className="text-[18px] font-black tracking-tighter text-slate-900 leading-none">KeyWord NewsBot</h1>
            <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Intelligence Monitor v6.8</p>
          </div>
        </div>
        <button 
          onClick={() => setShowTickerMgr(true)} 
          className="p-2 text-slate-400 hover:text-teal-600 active:scale-90 transition-all"
        >
          <LineChart size={20} />
        </button>
      </header>

      <main className="p-3 space-y-3 max-w-2xl mx-auto">
        {/* 키워드 관리 섹션 - 마진/패딩 축소 및 버튼 통합 */}
        <section className="bg-white rounded-xl shadow-sm border p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-black flex items-center gap-2"><Search size={18} className="text-teal-500"/> 검색 Keyword</h2>
            <div className="flex items-center bg-slate-100 rounded-full px-2 py-0.5 border">
              <span className="text-[9px] font-bold text-slate-400 mr-1.5">PERIOD</span>
              <select value={lookback} onChange={(e) => setLookback(Number(e.target.value))} className="bg-transparent text-[10px] font-bold outline-none">
                <option value={2}>2일</option><option value={7}>1주</option><option value={30}>1달</option>
              </select>
            </div>
          </div>

          {/* 입력창과 버튼들 한 줄 배치 */}
          <form onSubmit={addKeywordAction} className="flex gap-1.5">
            <input 
              type="text" 
              value={newKeyword} 
              onChange={(e) => setNewKeyword(e.target.value)} 
              placeholder="키워드 추가" 
              className="flex-1 bg-slate-50 border rounded-lg px-3 py-2 text-[13px] font-bold outline-none focus:border-teal-500 shadow-inner"
            />
            <button type="submit" className="bg-slate-900 text-white p-3 rounded-lg active:scale-95 transition-all shrink-0">
              <Plus size={20} />
            </button>
            <button 
              type="button"
              onClick={searchNews} 
              disabled={isSearching || keywords.length === 0} 
              className="bg-teal-500 text-white px-8 py-2 rounded-lg font-black text-[15px] shadow-sm active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
            >
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
                    <h3 className={`font-black text-[15px] flex items-center gap-1.5 ${theme.text}`}>{res.name}</h3>
                    <a href={`https://news.google.com/search?q=${encodeURIComponent(res.query)}`} target="_blank" rel="noreferrer" className={`text-[10px] font-bold ${theme.text} ${theme.bg} px-2 py-1 rounded-md flex items-center gap-0.5`}>
                      더보기 <ChevronRight size={12} />
                    </a>
                  </div>
                  <div className="space-y-2">
                    {res.articles.map((art, aIdx) => {
                      return (
                        <a key={aIdx} href={art.link} target="_blank" rel="noreferrer" className="block p-2 rounded-lg bg-slate-50 active:bg-slate-100 border transition-colors hover:border-teal-200 group">
                          <p className="text-[13px] font-bold text-slate-800 leading-normal mb-2 group-hover:text-teal-700 line-clamp-2">{art.title}</p>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md border bg-slate-100 text-slate-600 border-slate-200">
                              {art.source}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">{art.date}</span>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 티커 관리 모달 */}
      {showTickerMgr && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2"><BarChart3 size={20} className="text-teal-600" /><h3 className="font-black text-lg text-slate-900">티커 관리</h3></div>
              <button onClick={() => setShowTickerMgr(false)} className="text-slate-400"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <form onSubmit={addTickerAction} className="space-y-3">
                <div className="flex gap-2">
                  <input type="text" value={newTickerSymbol} onChange={e=>setNewTickerSymbol(e.target.value)} placeholder="심볼 입력 (NVDA, 005930.KS)" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-teal-500 uppercase shadow-inner" disabled={isAddingTicker} />
                  <button type="submit" className="bg-teal-600 text-white px-5 rounded-xl font-black shadow-md hover:bg-teal-700 transition-all flex items-center justify-center disabled:opacity-50" disabled={isAddingTicker || !newTickerSymbol.trim()}>{isAddingTicker ? <Loader2 className="animate-spin" size={18} /> : "추가"}</button>
                </div>
                <p className="text-[9px] text-slate-400 pl-1">심볼 예시: ^KS11(코스피), ^IXIC(나스닥), KRW=X(환율), AAPL(애플)</p>
              </form>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 border-t border-slate-100 pt-4">
                {tickers.map(tk => (
                  <div key={tk.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex flex-col"><span className="text-xs font-black text-slate-800 line-clamp-1">{tk.name}</span><span className="text-[10px] text-slate-400 font-mono">{tk.symbol}</span></div>
                    <button onClick={() => deleteTicker(tk.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {statusMsg && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-xl z-[100] animate-bounce text-sm whitespace-nowrap">{statusMsg}</div>}

      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } } 
        .animate-marquee { display: flex; animation: marquee 50s linear infinite; }
        .animate-marquee:hover { animation-play-state: paused; }
      `}</style>
    </div>
  );
}