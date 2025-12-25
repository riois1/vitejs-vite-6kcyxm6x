import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  RefreshCcw, 
  Mail, 
  Settings, 
  TrendingUp, 
  FileText,
  X,
  AlertCircle,
  ChevronRight,
  Globe,
  BarChart3,
  Calendar,
  Download,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  ExternalLink,
  LineChart,
  Loader2
} from 'lucide-react';

// Firebase 설정
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  query 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signInWithCustomToken 
} from 'firebase/auth';

/**
 * [KeyWord NewsBot v6.8 - Global Investment Dashboard]
 * - 디자인: v6.1 고밀도 슬림 디자인 유지
 * - 티커 최적화: 미국 주식(USD) 소수점 1자리, 한국 주식(원) 정수 표기
 * - 기본 리스트: 주요 지수(6개) + 국산주(8개) + 미주(8개) 총 22개 기본 셋팅
 * - 기능: 심볼 입력 시 종목명 자동 추출 및 단위 자동 판별
 */

// Firebase 환경 설정 (Canvas 환경 제공 변수 사용)
const firebaseConfig = {
  apiKey: "AIzaSyBZW2aYSpge5WhB1MnjB_dcxL2zlTbylEs",
  authDomain: "kwnb-292e4.firebaseapp.com",
  projectId: "kwnb-292e4",
  storageBucket: "kwnb-292e4.firebasestorage.app",
  messagingSenderId: "334663791620",
  appId: "1:334663791620:web:0d4a1d22f7e688f9737151",
  measurementId: "G-XW9D8KSTG9"
}
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'keyword-newsbot-v6';

const THEME_COLORS = [
  { border: 'border-t-teal-500', bg: 'bg-teal-50', text: 'text-teal-600', dot: 'bg-teal-500' },
  { border: 'border-t-blue-500', bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500' },
  { border: 'border-t-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-500' },
  { border: 'border-t-rose-500', bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500' },
  { border: 'border-t-amber-500', bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
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
  const [showSettings, setShowSettings] = useState(false);
  const [showTickerMgr, setShowTickerMgr] = useState(false); 
  const [email, setEmail] = useState("user@kdb.co.kr");
  const [lookback, setLookback] = useState(2); 

  // PWA 및 앱 아이콘 설정 (모바일에서 홈 화면 추가 시 돋보기 아이콘 적용)
  useEffect(() => {
    const iconSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2314b8a6' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'%3E%3C/circle%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'%3E%3C/line%3E%3C/svg%3E`;
    const metaTags = [
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-title', content: 'NewsBot' }
    ];
    metaTags.forEach(tag => {
      let meta = document.querySelector(`meta[name="${tag.name}"]`);
      if (!meta) { meta = document.createElement('meta'); meta.name = tag.name; document.head.appendChild(meta); }
      meta.content = tag.content;
    });
    let linkIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (!linkIcon) { linkIcon = document.createElement('link'); linkIcon.rel = 'apple-touch-icon'; document.head.appendChild(linkIcon); }
    linkIcon.href = iconSvg;
  }, []);

  // Firebase 익명 인증
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else { await signInAnonymously(auth); }
      } catch (err) { console.error("인증 실패:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 데이터 동기화 (키워드 및 티커 리스트)
  useEffect(() => {
       
    // 키워드 데이터 읽기
    const kwRef = collection(db, 'artifacts', appId, 'public', 'data', 'keywords');
    const unsubKw = onSnapshot(kwRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setKeywords(list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      if (list.length === 0) {
        ["산업은행", "삼성전자", "반도체"].forEach(n => addDoc(kwRef, { name: n, createdAt: Date.now() }));
      }
    });

    // 티커 데이터 읽기 (기본 지수 + 인기 종목 셋팅)
    const tkRef = collection(db, 'artifacts', appId, 'public', 'data', 'tickers');
    const unsubTk = onSnapshot(tkRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTickers(list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      
      if (list.length === 0) {
        const defaults = [
          { name: 'KOSPI', symbol: '^KS11', unit: 'p' },
          { name: 'KOSDAQ', symbol: '^KQ11', unit: 'p' },
          { name: 'USD/KRW', symbol: 'KRW=X', unit: '원' },
          { name: 'NASDAQ', symbol: '^IXIC', unit: 'p' },
          { name: 'DOW JONES', symbol: '^DJI', unit: 'p' },
          { name: 'S&P 500', symbol: '^GSPC', unit: 'p' },
          { name: '삼성전자', symbol: '005930.KS', unit: '원' },
          { name: 'SK하이닉스', symbol: '000660.KS', unit: '원' },
          { name: 'LG에너지솔루션', symbol: '373220.KS', unit: '원' },
          { name: '삼성바이오', symbol: '207940.KS', unit: '원' },
          { name: '현대차', symbol: '005380.KS', unit: '원' },
          { name: '셀트리온', symbol: '068270.KS', unit: '원' },
          { name: '기아', symbol: '000270.KS', unit: '원' },
          { name: 'POSCO홀딩스', symbol: '005490.KS', unit: '원' },
          { name: 'Apple', symbol: 'AAPL', unit: 'USD' },
          { name: 'Microsoft', symbol: 'MSFT', unit: 'USD' },
          { name: 'Nvidia', symbol: 'NVDA', unit: 'USD' },
          { name: 'Google', symbol: 'GOOGL', unit: 'USD' },
          { name: 'Amazon', symbol: 'AMZN', unit: 'USD' },
          { name: 'Meta', symbol: 'META', unit: 'USD' },
          { name: 'Tesla', symbol: 'TSLA', unit: 'USD' },
          { name: 'Eli Lilly', symbol: 'LLY', unit: 'USD' }
        ];
        defaults.forEach(t => addDoc(tkRef, { ...t, createdAt: Date.now() }));
      }
    });

    return () => { unsubKw(); unsubTk(); };
  }, [user]);

  // Yahoo Finance 시세 수집 및 포맷팅 로직
  const fetchMarketTicker = async () => {
    if (tickers.length === 0) return;
    try {
      const results = await Promise.all(tickers.map(async (t) => {
        const ts = Date.now();
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${t.symbol}?interval=1d&range=5d&_=${ts}`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        try {
          const res = await fetch(proxyUrl);
          const rawData = await res.json();
          const data = JSON.parse(rawData.contents);
          
          if (data?.chart?.result?.[0]) {
            const meta = data.chart.result[0].meta;
            const indicators = data.chart.result[0].indicators?.quote?.[0] || {};
            const closes = indicators.close?.filter(v => v !== null) || [];
            
            const curPrice = meta.regularMarketPrice || closes[closes.length - 1];
            const prevPrice = meta.previousClose || closes[closes.length - 2];
            
            if (curPrice === undefined) throw new Error("Price missing");

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
              formattedDiff = Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
            }

            return { name: t.name, price: formattedPrice, unit: t.unit, diff: formattedDiff, pct: `${diff >= 0 ? '+' : ''}${pct}%`, isUp: diff >= 0 };
          }
        } catch (e) { console.warn(`${t.name} Load Fail`); }
        return { name: t.name, price: '-', diff: '-', pct: '0%', isUp: true, unit: null };
      }));
      setMarketData(results);
    } catch (err) { console.error("Ticker fetch error", err); }
  };

  useEffect(() => { fetchMarketTicker(); }, [tickers]);

  // 구글 뉴스 검색 로직
  const searchNews = async () => {
    if (keywords.length === 0) return;
    setIsSearching(true);
    setStatusMsg(`${lookback}일간의 뉴스를 수집 중...`);
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
            name: kw.name, query: queryStr, totalCount: data.items.length,
            articles: data.items.slice(0, 3).map(item => {
              const pDate = new Date(item.pubDate);
              const dateStr = `${pDate.getFullYear()}.${pDate.getMonth() + 1}.${pDate.getDate()}`;
              const splitTitle = item.title.split(' - ');
              return { title: splitTitle.length > 1 ? splitTitle.slice(0, -1).join(' - ') : item.title, link: item.link, source: splitTitle.length > 1 ? splitTitle[splitTitle.length - 1] : (item.author || "뉴스"), date: dateStr };
            }),
          });
        }
      }
      setReport(results);
      setStatusMsg("수집이 완료되었습니다.");
      setTimeout(() => setStatusMsg(""), 3000);
    } catch (err) { setStatusMsg("검색 중 오류 발생"); }
    finally { setIsSearching(false); }
  };

  // 리포트 저장 함수
  const saveReport = () => {
    if (!report) return;
    const todayStr = new Date().toLocaleDateString();
    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body { font-family: sans-serif; padding: 15px; background: #f1f5f9; color: #1e293b; line-height: 1.5; } .header { background: #0f172a; color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; text-align: center; } .card { background: white; border-radius: 12px; padding: 15px; margin-bottom: 15px; border-top: 5px solid #14b8a6; box-shadow: 0 2px 4px rgba(0,0,0,0.05); } .title { font-size: 14px; font-weight: bold; margin-bottom: 5px; color: #334155; text-decoration: none; display: block; } .meta { font-size: 11px; color: #94a3b8; } .company-name { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; border-left: 4px solid #14b8a6; padding-left: 10px; }</style></head><body><div class="header"><h1 style="margin:0; font-size:20px;">KeyWord NewsBot Intelligence</h1><p style="margin:5px 0 0 0; opacity:0.6; font-size:12px;">발행일자: ${todayStr}</p></div>${report.map(r => `<div class="card"><h2 class="company-name">${r.name}</h2>${r.articles.map(a => `<a href="${a.link}" class="title">${a.title}</a><div class="meta">${a.source} | ${a.date}</div><hr style="opacity:0.05; margin:12px 0;">`).join('')}</div>`).join('')}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Report_${todayStr.replace(/\. /g, '_')}.html`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); setStatusMsg("파일 다운로드 완료");
  };

  const addKeywordAction = async (e) => { e.preventDefault(); if (!newKeyword.trim() || !user) return; await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'keywords'), { name: newKeyword.trim(), createdAt: Date.now() }); setNewKeyword(""); };
  const deleteKeyword = async (id) => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'keywords', id)); };

  const addTickerAction = async (e) => {
    e.preventDefault();
    if (!newTickerSymbol.trim() || !user || isAddingTicker) return;
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
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tickers'), { name: resolvedName, symbol, unit, createdAt: Date.now() });
        setNewTickerSymbol(""); setStatusMsg(`${resolvedName} 추가 완료`);
      } else { setStatusMsg("유효하지 않은 심볼"); }
    } catch (err) { setStatusMsg("심볼 확인 오류"); }
    finally { setIsAddingTicker(false); setTimeout(() => setStatusMsg(""), 3000); }
  };
  const deleteTicker = async (id) => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickers', id)); };

  return (
    <div className="min-h-screen bg-[#F1F5F9] font-sans text-slate-900 pb-12 overflow-x-hidden">
      
      {/* [티커] 슬림 고집약 정보 바 */}
      <section className="bg-[#0F172A] text-white border-b border-teal-500/40 overflow-hidden h-7 flex items-center relative z-50 shadow-sm">
        <div className="flex whitespace-nowrap animate-marquee">
          {[...marketData, ...marketData].map((m, idx) => (
            <div key={idx} className="flex items-center gap-2 px-5 border-r border-slate-800/60">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-tight">{m.name}</span>
              <span className="text-[10px] font-bold tracking-tight text-white">
                {m.price}{m.price !== '-' && m.unit && <span className="text-[8px] ml-0.5 opacity-40 font-normal">{m.unit}</span>}
              </span>
              <span className={`text-[9px] font-bold ${m.isUp ? 'text-rose-400' : 'text-blue-400'}`}>
                {m.isUp ? '▲' : '▼'}{m.diff}{m.price !== '-' && m.unit && <span className="text-[7px] ml-0.5 opacity-40">{m.unit}</span>} 
                {m.price !== '-' && <span className="ml-0.5 opacity-60">({m.pct})</span>}
              </span>
            </div>
          ))}
          {marketData.length === 0 && <span className="text-[8px] text-slate-500 px-10 tracking-widest uppercase">Initializing Global Ticker...</span>}
        </div>
      </section>

      {/* 헤더 */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 py-2.5 px-4 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-slate-900 p-1.5 rounded-lg shadow-sm">
              <Globe size={18} className="text-teal-400" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tighter text-slate-900 leading-none">KeyWord NewsBot</h1>
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">Intelligence Monitor v6.8</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowTickerMgr(true)} className="p-1.5 text-slate-400 hover:text-teal-600 active:scale-90 transition-all"><LineChart size={18} /></button>
            <button onClick={() => setShowSettings(true)} className="p-1.5 text-slate-400 hover:text-slate-900 active:scale-90 transition-all"><Settings size={18} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-3 md:p-5 space-y-4">
        {/* 검색 키워드 관리 */}
        <section className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          <div className="p-4 md:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="bg-teal-500 p-1.5 rounded-lg text-white"><Search size={14} strokeWidth={3} /></div>
                <h2 className="text-base font-black text-slate-800 tracking-tight">검색 Keyword</h2>
              </div>
              <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-200">
                <div className="px-2 flex items-center gap-1.5 text-slate-400"><Clock size={10} /><span className="text-[8px] font-black uppercase">Period</span></div>
                <select value={lookback} onChange={(e) => setLookback(Number(e.target.value))} className="bg-white text-slate-600 text-[9px] font-black px-2 py-1 rounded-md outline-none cursor-pointer min-w-[70px]">
                  <option value={2}>2일</option><option value={7}>1주일</option><option value={30}>1개월</option><option value={365}>1년</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-2">
              <form onSubmit={addKeywordAction} className="flex-1 relative group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} placeholder="키워드를 입력하세요" className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 shadow-inner" />
                <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-slate-900 text-white p-1.5 rounded-lg active:scale-95"><Plus size={16} strokeWidth={3} /></button>
              </form>
              <div className="flex gap-2">
                <button onClick={searchNews} disabled={isSearching || keywords.length === 0} className={`flex-1 md:px-5 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 ${isSearching ? 'bg-slate-200 text-slate-400' : 'bg-teal-500 text-white hover:bg-teal-600'}`}>{isSearching ? <RefreshCcw size={14} className="animate-spin" /> : <FileText size={14} />}뉴스검색</button>
                {report && <button onClick={saveReport} className="p-2.5 bg-white border border-slate-200 rounded-xl text-teal-600 hover:bg-teal-50 shadow-sm active:scale-90 transition-all"><Download size={18} /></button>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-50">
              {keywords.map((kw) => (
                <div key={kw.id} className="bg-white border border-slate-200 pl-3 pr-1.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 flex items-center gap-2 shadow-sm group hover:border-teal-300">{kw.name}<button onClick={() => deleteKeyword(kw.id)} className="text-slate-300 hover:text-rose-500"><X size={10} /></button></div>
              ))}
            </div>
          </div>
        </section>

        {/* 뉴스 리포트 카드 */}
        {report && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-3 duration-500 pb-10">
            {report.map((res, idx) => {
              const theme = THEME_COLORS[idx % THEME_COLORS.length];
              return (
                <div key={idx} className={`bg-white rounded-2xl border-t-4 ${theme.border} p-4 shadow-md transition-all hover:shadow-lg`}>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h4 className={`text-sm font-black ${theme.text} tracking-tight flex items-center gap-1.5 cursor-pointer hover:underline`} onClick={() => window.open(`https://news.google.com/search?q=${encodeURIComponent(res.query)}`, '_blank')}>{res.name}<ExternalLink size={10} className="opacity-40" /></h4>
                    <button onClick={() => window.open(`https://news.google.com/search?q=${encodeURIComponent(res.query)}`, '_blank')} className={`text-[8px] font-black px-2 py-0.5 rounded-md ${theme.bg} ${theme.text} hover:opacity-75 uppercase`}>더보기</button>
                  </div>
                  <div className="space-y-1.5">
                    {res.articles.map((art, aIdx) => (
                      <a key={aIdx} href={art.link} target="_blank" rel="noreferrer" className="block p-3 rounded-2xl bg-slate-50 border border-transparent hover:bg-white hover:border-teal-100 hover:shadow-sm transition-all group">
                        <p className="text-[12px] font-bold text-slate-700 leading-snug mb-1.5 group-hover:text-teal-600 line-clamp-2">{art.title}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5"><div className={`w-1 h-1 rounded-full ${theme.dot} opacity-40`}></div><span className="text-[8px] font-black text-slate-400 uppercase">{art.source}</span><span className="text-[8px] font-bold text-slate-300">{art.date}</span></div>
                          <ChevronRight size={10} className="text-slate-200 group-hover:text-teal-500" />
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

      {/* 상태 알림 */}
      {statusMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-2.5 rounded-full shadow-2xl z-50 flex items-center gap-3 animate-in slide-in-from-bottom-6 border border-teal-500/20">
          <div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-ping"></div><span className="text-[10px] font-bold tracking-tight">{statusMsg}</span>
        </div>
      )}

      {/* 모달: 티커 관리 */}
      {showTickerMgr && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2"><BarChart3 size={20} className="text-teal-600" /><h3 className="font-black text-lg text-slate-900">티커 관리</h3></div>
              <button onClick={() => setShowTickerMgr(false)} className="text-slate-400"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <form onSubmit={addTickerAction} className="space-y-3">
                <div className="flex gap-2">
                  <input type="text" value={newTickerSymbol} onChange={e=>setNewTickerSymbol(e.target.value)} placeholder="심볼 입력 (예: NVDA, AAPL)" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-teal-500 uppercase shadow-inner" disabled={isAddingTicker} />
                  <button type="submit" className="bg-teal-600 text-white px-5 rounded-xl font-black shadow-md hover:bg-teal-700 transition-all flex items-center justify-center disabled:opacity-50" disabled={isAddingTicker || !newTickerSymbol.trim()}>{isAddingTicker ? <Loader2 className="animate-spin" size={18} /> : "추가"}</button>
                </div>
                <p className="text-[9px] text-slate-400 pl-1 leading-relaxed">심볼 예시: ^KS11(코스피), ^IXIC(나스닥), KRW=X(환율), 005930.KS(삼성전자)</p>
              </form>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1 border-t border-slate-100 pt-4">
                {tickers.map(tk => (
                  <div key={tk.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100"><div className="flex flex-col"><span className="text-xs font-black text-slate-800 line-clamp-1">{tk.name}</span><span className="text-[10px] text-slate-400 font-mono tracking-tight">{tk.symbol} ({tk.unit})</span></div><button onClick={() => deleteTicker(tk.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 모달: 설정 */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6"><h3 className="font-black text-lg text-slate-900 w-full text-center">Settings</h3><button onClick={() => setShowSettings(false)} className="text-slate-400 absolute right-6"><X size={24} /></button></div>
            <div className="space-y-6">
              <div className="space-y-2 text-center"><label className="text-[8px] font-black text-slate-400 uppercase block">Report Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-teal-500 shadow-inner" /></div>
              <button onClick={() => setShowSettings(false)} className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-black text-sm shadow-xl active:scale-95 transition-all">저장 완료</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { display: flex; animation: marquee 50s linear infinite; }
        .animate-marquee:hover { animation-play-state: paused; }
      `}</style>
      <footer className="py-12 text-center opacity-20 select-none">
        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">© 2024 KeyWord Intelligence • Stable v6.8</p>
      </footer>
    </div>
  );
}