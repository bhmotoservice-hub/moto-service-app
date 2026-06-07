import React, { useState, useEffect, useRef, useCallback } from "react";

const GMAPS_KEY = "AIzaSyAtF-VYO4iJ_8Dm-iY8T3mz0RbH92_2lJU";

const STATUS_OS = {
  aguardando:        { label: "Aguardando",          cor: "#6B7280" },
  aguardando_coleta: { label: "A caminho da coleta",  cor: "#F59E0B" },
  em_rota:           { label: "Em rota",              cor: "#3B82F6" },
  entregue:          { label: "Entregue",             cor: "#10B981" },
  cancelado:         { label: "Cancelado",            cor: "#EF4444" },
};
const STATUS_MOTOBOY = {
  disponivel: { label: "Disponível", cor: "#10B981" },
  em_rota:    { label: "Em rota",    cor: "#F59E0B" },
  inativo:    { label: "Inativo",    cor: "#6B7280" },
};
const G = {
  laranja:"#F5640A", preto:"#111111", superficie:"#1C1C1E",
  superficie2:"#242426", borda:"#2E2E30", texto:"#F2F2F5",
  textoMuted:"#8E8E93", sucesso:"#10B981", atencao:"#F59E0B",
  info:"#3B82F6", perigo:"#EF4444",
};

// ─── HOOK: GOOGLE MAPS ────────────────────────────────────────────
function useGoogleMaps() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (window.google?.maps) { setLoaded(true); return; }
    if (document.getElementById("gmaps-script")) {
      const t = setInterval(() => { if (window.google?.maps) { setLoaded(true); clearInterval(t); } }, 300);
      return () => clearInterval(t);
    }
    const s = document.createElement("script");
    s.id = "gmaps-script";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places&language=pt-BR&region=BR`;
    s.async = true;
    s.onload = () => setLoaded(true);
    document.head.appendChild(s);
  }, []);
  return loaded;
}

// ─── AUTOCOMPLETE ENDEREÇO (fetch via Places API) ─────────────────
function InputEndereco({ value, onChange, placeholder }) {
  const [query, setQuery] = useState(value || "");
  const [sugestoes, setSugestoes] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 300 });
  const inputRef = useRef(null);
  const timer = useRef(null);
  const mapsLoaded = useGoogleMaps();

  const atualizarPos = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
    }
  };

  const buscar = useCallback((texto) => {
    if (!texto || texto.length < 3 || !mapsLoaded) { setSugestoes([]); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(texto)}&language=pt-BR&region=br&components=country:br&location=-19.9167,-43.9345&radius=80000&key=${GMAPS_KEY}`
        );
        const data = await res.json();
        if (data.predictions) setSugestoes(data.predictions.slice(0, 5));
      } catch (_) {}
    }, 350);
  }, [mapsLoaded]);

  const geocodificar = async (placeId, descricao) => {
    setQuery(descricao);
    setSugestoes([]);
    setAberto(false);
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?place_id=${placeId}&key=${GMAPS_KEY}`
      );
      const data = await res.json();
      const loc = data.results?.[0]?.geometry?.location;
      onChange({ endereco: descricao, lat: loc?.lat || null, lng: loc?.lng || null });
    } catch (_) {
      onChange({ endereco: descricao, lat: null, lng: null });
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); onChange({ endereco: e.target.value, lat: null, lng: null }); buscar(e.target.value); atualizarPos(); setAberto(true); }}
        onFocus={() => { atualizarPos(); if (sugestoes.length) setAberto(true); }}
        onBlur={() => setTimeout(() => setAberto(false), 200)}
        placeholder={placeholder || "Digite o endereço..."}
        style={{ width: "100%", background: G.superficie2, border: `1px solid ${G.borda}`, borderRadius: 8, padding: "10px 12px", color: G.texto, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "'Syne', sans-serif" }}
      />
      {aberto && sugestoes.length > 0 && (
        <div style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, background: G.superficie, border: `1px solid ${G.borda}`, borderRadius: 8, zIndex: 9999, boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}>
          {sugestoes.map((s, i) => (
            <div key={s.place_id}
              onMouseDown={() => geocodificar(s.place_id, s.description)}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: i < sugestoes.length - 1 ? `1px solid ${G.borda}` : "none", display: "flex", gap: 10, alignItems: "flex-start" }}
              onMouseEnter={e => e.currentTarget.style.background = G.superficie2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>📍</span>
              <div>
                <p style={{ margin: 0, fontSize: 13, color: G.texto, fontWeight: 500 }}>
                  {s.structured_formatting?.main_text || s.description}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: G.textoMuted }}>
                  {s.structured_formatting?.secondary_text || ""}
                </p>
              </div>
            </div>
          ))}
          <div style={{ padding: "6px 14px", borderTop: `1px solid ${G.borda}`, display: "flex", justifyContent: "flex-end" }}>
            <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-non-white3.png" alt="Powered by Google" style={{ height: 14, opacity: 0.6 }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MINI MAPA ────────────────────────────────────────────────────
function MiniMapa({ paradas }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);
  const mapsLoaded = useGoogleMaps();

  useEffect(() => {
    if (!mapsLoaded || !ref.current) return;
    const validas = paradas.filter(p => p.lat && p.lng);
    if (validas.length < 2) return;

    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(ref.current, {
        zoom: 13,
        center: { lat: validas[0].lat, lng: validas[0].lng },
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
          { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });
    }

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) polylineRef.current.setMap(null);

    const map = mapRef.current;
    const bounds = new window.google.maps.LatLngBounds();

    validas.forEach((p, i) => {
      const cor = p.tipo === "coleta" ? "#F5640A" : "#10B981";
      const marker = new window.google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map,
        title: p.endereco,
        label: { text: p.tipo === "coleta" ? "C" : "E", color: "#fff", fontSize: "11px", fontWeight: "bold" },
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: cor, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
      });
      markersRef.current.push(marker);
      bounds.extend({ lat: p.lat, lng: p.lng });
    });

    polylineRef.current = new window.google.maps.Polyline({
      path: validas.map(p => ({ lat: p.lat, lng: p.lng })),
      geodesic: true, strokeColor: "#F5640A", strokeOpacity: 0.7, strokeWeight: 2, map,
    });

    map.fitBounds(bounds, 48);
  }, [mapsLoaded, paradas]);

  const validas = paradas.filter(p => p.lat && p.lng);
  if (validas.length < 2) return null;

  return (
    <div style={{ marginTop: 10, borderRadius: 10, overflow: "hidden", border: `1px solid ${G.borda}` }}>
      <div ref={ref} style={{ width: "100%", height: 200 }} />
      <div style={{ background: G.superficie2, padding: "8px 12px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10 }}>
          {[{ cor: G.laranja, label: "Coleta" }, { cor: G.sucesso, label: "Entrega" }].map(({ cor, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: cor }} />
              <span style={{ fontSize: 11, color: G.textoMuted }}>{label}</span>
            </div>
          ))}
        </div>
        <a href={`https://www.google.com/maps/dir/${validas.map(p => `${p.lat},${p.lng}`).join("/")}`}
          target="_blank" rel="noreferrer"
          style={{ marginLeft: "auto", fontSize: 11, color: G.laranja, textDecoration: "none", fontWeight: 600 }}>
          Abrir no Google Maps ↗
        </a>
      </div>
    </div>
  );
}

// ─── GERENCIADOR DE PARADAS ───────────────────────────────────────
function GerenciadorParadas({ paradas, onChange, historicoEnderecos }) {
  const [historicoAberto, setHistoricoAberto] = useState(null);

  const addParada = () => onChange([...paradas, { tipo: "entrega", endereco: "", lat: null, lng: null }]);
  const removeParada = i => onChange(paradas.filter((_, idx) => idx !== i));
  const updateParada = (i, val) => { const n = [...paradas]; n[i] = { ...n[i], ...val }; onChange(n); };

  const sugestoes = [...new Set(historicoEnderecos.filter(Boolean))].slice(0, 5);

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: G.textoMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>Paradas ({paradas.length})</label>
        <button type="button" onClick={addParada}
          style={{ fontSize: 12, fontWeight: 600, color: G.laranja, background: "transparent", border: `1px solid ${G.laranja}44`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
          + Adicionar parada
        </button>
      </div>

      {paradas.map((p, i) => (
        <div key={i} style={{ background: G.superficie2, borderRadius: 10, padding: 12, marginBottom: 10, border: `1px solid ${G.borda}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["coleta", "entrega"].map(t => (
                <button key={t} type="button" onClick={() => updateParada(i, { tipo: t })}
                  style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, cursor: "pointer", border: "none", textTransform: "uppercase", fontFamily: "'Syne', sans-serif", background: p.tipo === t ? (t === "coleta" ? G.laranja : G.sucesso) : G.borda, color: p.tipo === t ? "#fff" : G.textoMuted }}>
                  {t === "coleta" ? "📦 Coleta" : "📍 Entrega"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {sugestoes.length > 0 && (
                <button type="button" onClick={() => setHistoricoAberto(historicoAberto === i ? null : i)}
                  style={{ fontSize: 11, color: G.textoMuted, background: G.borda, border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
                  🕐 Recentes
                </button>
              )}
              {paradas.length > 1 && (
                <button type="button" onClick={() => removeParada(i)}
                  style={{ fontSize: 11, color: G.perigo, background: G.perigo + "22", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
                  ✕
                </button>
              )}
            </div>
          </div>

          <InputEndereco value={p.endereco} onChange={val => updateParada(i, val)}
            placeholder={p.tipo === "coleta" ? "Endereço de coleta..." : "Endereço de entrega..."} />

          {historicoAberto === i && sugestoes.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p style={{ margin: "0 0 6px", fontSize: 10, color: G.textoMuted, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Endereços recentes</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {sugestoes.map((s, si) => (
                  <button key={si} type="button"
                    onClick={() => { updateParada(i, { endereco: s, lat: null, lng: null }); setHistoricoAberto(null); }}
                    style={{ textAlign: "left", background: G.superficie, border: `1px solid ${G.borda}`, borderRadius: 6, padding: "7px 10px", cursor: "pointer", fontSize: 12, color: G.texto, fontFamily: "'Syne', sans-serif" }}>
                    📍 {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {p.lat && p.lng && (
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: G.sucesso }} />
              <span style={{ fontSize: 11, color: G.sucesso }}>Localização confirmada</span>
            </div>
          )}
        </div>
      ))}

      {paradas.filter(p => p.lat && p.lng).length >= 2 && <MiniMapa paradas={paradas} />}
    </div>
  );
}

// ─── COMPONENTES BASE ─────────────────────────────────────────────
const Badge = ({ cor, children }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: cor + "22", color: cor, border: `1px solid ${cor}44`, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
    <span style={{ width: 6, height: 6, borderRadius: "50%", background: cor, flexShrink: 0 }} />
    {children}
  </span>
);

const Btn = ({ onClick, children, variant = "primary", size = "md", style: s = {} }) => {
  const sizes = { sm: { padding: "6px 14px", fontSize: 12 }, md: { padding: "10px 20px", fontSize: 13 }, lg: { padding: "14px 28px", fontSize: 14 } };
  const variants = {
    primary: { background: G.laranja, color: "#fff", border: "none" },
    ghost: { background: "transparent", color: G.textoMuted, border: `1px solid ${G.borda}` },
    danger: { background: "#EF444422", color: G.perigo, border: `1px solid ${G.perigo}44` },
    success: { background: "#10B98122", color: G.sucesso, border: `1px solid ${G.sucesso}44` },
  };
  return <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", fontFamily: "'Syne', sans-serif", fontWeight: 600, borderRadius: 10, transition: "all 0.15s", letterSpacing: "0.02em", ...sizes[size], ...variants[variant], ...s }}>{children}</button>;
};

const Avatar = ({ iniciais, size = 36 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg, ${G.laranja}, #c44b00)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.33, fontWeight: 700, color: "#fff", fontFamily: "'Syne', sans-serif", flexShrink: 0 }}>{iniciais}</div>
);

const Modal = ({ titulo, onClose, children, wide }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: G.superficie, border: `1px solid ${G.borda}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: wide ? 680 : 520, maxHeight: "92vh", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ color: G.texto, fontSize: 16, fontWeight: 700, margin: 0, fontFamily: "'Syne', sans-serif" }}>{titulo}</h2>
        <button onClick={onClose} style={{ background: G.borda, border: "none", color: G.textoMuted, borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 16 }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

const Input = ({ label, value, onChange, placeholder, type = "text" }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: G.textoMuted, marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</label>}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", background: G.superficie2, border: `1px solid ${G.borda}`, borderRadius: 8, padding: "10px 12px", color: G.texto, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "'Syne', sans-serif" }} />
  </div>
);

const Select = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: G.textoMuted, marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</label>}
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", background: G.superficie2, border: `1px solid ${G.borda}`, borderRadius: 8, padding: "10px 12px", color: G.texto, fontSize: 13, outline: "none", cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

// ─── AUTOCOMPLETE CLIENTE ─────────────────────────────────────────
function InputCliente({ value, onChange, clientes }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const filtrados = clientes.filter(c => query.length >= 1 && c.nome.toLowerCase().includes(query.toLowerCase()));

  return (
    <div style={{ marginBottom: 14, position: "relative" }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: G.textoMuted, marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>Cliente</label>
      <input type="text" value={query}
        onChange={e => { setQuery(e.target.value); onChange({ nome: e.target.value, id: null }); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Nome do cliente ou empresa"
        style={{ width: "100%", background: G.superficie2, border: `1px solid ${G.borda}`, borderRadius: 8, padding: "10px 12px", color: G.texto, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "'Syne', sans-serif" }} />
      {open && filtrados.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: G.superficie, border: `1px solid ${G.borda}`, borderRadius: 8, zIndex: 100, maxHeight: 200, overflowY: "auto", marginTop: 4 }}>
          {filtrados.map(c => (
            <div key={c.id} onMouseDown={() => { setQuery(c.nome); onChange({ nome: c.nome, id: c.id }); setOpen(false); }}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${G.borda}` }}
              onMouseEnter={e => e.currentTarget.style.background = G.superficie2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: G.texto }}>{c.nome}</p>
              <p style={{ margin: 0, fontSize: 11, color: G.textoMuted }}>{c.telefone}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FORMULÁRIO OS ────────────────────────────────────────────────
const FormOS = ({ os, motoboys, clientes, historicoEnderecos, onSave, onClose }) => {
  const [form, setForm] = useState(os || {
    cliente: "", cliente_id: null, descricao: "", valor: "",
    prioridade: "normal", motoboy_id: null, status: "aguardando",
    paradas: [
      { tipo: "coleta", endereco: "", lat: null, lng: null },
      { tipo: "entrega", endereco: "", lat: null, lng: null },
    ],
  });
  const f = k => v => setForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      <InputCliente value={form.cliente} clientes={clientes}
        onChange={({ nome, id }) => setForm(p => ({ ...p, cliente: nome, cliente_id: id || null }))} />
      <GerenciadorParadas paradas={form.paradas}
        onChange={paradas => setForm(p => ({ ...p, paradas }))}
        historicoEnderecos={historicoEnderecos} />
      <Input label="Descrição do item" value={form.descricao} onChange={f("descricao")} placeholder="Ex: documentos, medicamentos..." />
      <Input label="Valor (R$)" type="number" value={form.valor} onChange={f("valor")} placeholder="0,00" />
      <Select label="Prioridade" value={form.prioridade} onChange={f("prioridade")}
        options={[{ value: "normal", label: "Normal" }, { value: "urgente", label: "Urgente" }]} />
      <Select label="Atribuir motoboy" value={form.motoboy_id ?? ""} onChange={v => f("motoboy_id")(v === "" ? null : Number(v))}
        options={[{ value: "", label: "— Não atribuído —" }, ...motoboys.filter(m => m.status !== "inativo").map(m => ({ value: m.id, label: m.nome }))]} />
      {os && <Select label="Status" value={form.status} onChange={f("status")}
        options={Object.entries(STATUS_OS).map(([k, v]) => ({ value: k, label: v.label }))} />}
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <Btn onClick={onClose} variant="ghost" style={{ flex: 1 }}>Cancelar</Btn>
        <Btn onClick={() => onSave(form)} style={{ flex: 2 }}>{os ? "Salvar alterações" : "Criar ordem de serviço"}</Btn>
      </div>
    </div>
  );
};

// ─── CARD OS ─────────────────────────────────────────────────────
const CardOS = ({ os, motoboys, onEdit, onDelete }) => {
  const mb = motoboys.find(m => m.id === os.motoboy_id);
  const st = STATUS_OS[os.status];
  const [mapaAberto, setMapaAberto] = useState(false);
  const paradasValidas = (os.paradas || []).filter(p => p.lat && p.lng);

  return (
    <div style={{ background: G.superficie, border: `1px solid ${G.borda}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, color: G.laranja }}>{os.id}</span>
            {os.prioridade === "urgente" && <span style={{ fontSize: 10, fontWeight: 700, color: G.perigo, background: G.perigo + "22", padding: "2px 8px", borderRadius: 20, border: `1px solid ${G.perigo}44` }}>URGENTE</span>}
          </div>
          <p style={{ margin: 0, color: G.texto, fontWeight: 600, fontSize: 14, fontFamily: "'Syne', sans-serif" }}>{os.cliente}</p>
        </div>
        <Badge cor={st.cor}>{st.label}</Badge>
      </div>

      <div style={{ background: G.superficie2, borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        {(os.paradas || []).map((p, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 64, flexShrink: 0 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: p.tipo === "coleta" ? G.laranja : G.sucesso }} />
              <span style={{ fontSize: 10, color: p.tipo === "coleta" ? G.laranja : G.sucesso, fontWeight: 700, textTransform: "uppercase" }}>{p.tipo}</span>
            </div>
            <span style={{ fontSize: 12, color: G.textoMuted, lineHeight: 1.4 }}>{p.endereco}</span>
          </div>
        ))}
      </div>

      {paradasValidas.length >= 2 && (
        <button type="button" onClick={() => setMapaAberto(!mapaAberto)}
          style={{ background: "transparent", border: `1px solid ${G.borda}`, borderRadius: 8, padding: "6px 12px", color: G.textoMuted, fontSize: 12, cursor: "pointer", fontFamily: "'Syne', sans-serif", display: "flex", alignItems: "center", gap: 6, width: "fit-content" }}>
          🗺 {mapaAberto ? "Fechar mapa" : "Ver no mapa"}
        </button>
      )}
      {mapaAberto && <MiniMapa paradas={os.paradas} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {mb ? <><Avatar iniciais={mb.foto} size={26} /><span style={{ fontSize: 12, color: G.textoMuted }}>{mb.nome}</span></> : <span style={{ fontSize: 12, color: G.textoMuted }}>— Sem motoboy</span>}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: G.sucesso }}>R$ {Number(os.valor || 0).toFixed(2)}</span>
          <span style={{ fontSize: 11, color: G.textoMuted }}>{os.criado_em}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={() => onEdit(os)} variant="ghost" size="sm" style={{ flex: 1 }}>✏ Editar</Btn>
        <Btn onClick={() => onDelete(os.id)} variant="danger" size="sm">✕</Btn>
      </div>
    </div>
  );
};

// ─── PAINEL OS ────────────────────────────────────────────────────
const PainelOS = ({ os, setOs, motoboys, clientes }) => {
  const [modal, setModal] = useState(null);
  const [confirmarDelete, setConfirmarDelete] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");

  const historicoEnderecos = os.flatMap(o => (o.paradas || []).map(p => p.endereco)).filter(Boolean);
  const nextId = () => `OS-${String(os.length + 1).padStart(3, "0")}`;

  const salvarOS = form => {
    if (modal === "novo") setOs(prev => [...prev, { ...form, id: nextId(), criado_em: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) }]);
    else setOs(prev => prev.map(o => o.id === form.id ? { ...o, ...form } : o));
    setModal(null);
  };

  const deletar = id => setConfirmarDelete(id);
  const confirmarDeletar = () => { setOs(prev => prev.filter(o => o.id !== confirmarDelete)); setConfirmarDelete(null); };

  const filtrados = os.filter(o => {
    const mF = filtro === "todos" || o.status === filtro;
    const mB = o.cliente.toLowerCase().includes(busca.toLowerCase()) || o.id.includes(busca);
    return mF && mB;
  });
  const contadores = Object.keys(STATUS_OS).reduce((acc, k) => { acc[k] = os.filter(o => o.status === k).length; return acc; }, {});

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, color: G.texto, fontSize: 20, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>Ordens de serviço</h2>
          <p style={{ margin: 0, color: G.textoMuted, fontSize: 13 }}>{os.length} ordens hoje</p>
        </div>
        <Btn onClick={() => setModal("novo")}>+ Nova OS</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 20 }}>
        {Object.entries(STATUS_OS).map(([k, v]) => (
          <div key={k} onClick={() => setFiltro(filtro === k ? "todos" : k)}
            style={{ background: filtro === k ? v.cor + "22" : G.superficie, border: `1px solid ${filtro === k ? v.cor : G.borda}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer" }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: filtro === k ? v.cor : G.texto, fontFamily: "'Syne', sans-serif" }}>{contadores[k] || 0}</p>
            <p style={{ margin: 0, fontSize: 11, color: filtro === k ? v.cor : G.textoMuted, marginTop: 2 }}>{v.label}</p>
          </div>
        ))}
      </div>

      <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por cliente ou ID..."
        style={{ width: "100%", background: G.superficie, border: `1px solid ${G.borda}`, borderRadius: 8, padding: "10px 14px", color: G.texto, fontSize: 13, outline: "none", marginBottom: 16, boxSizing: "border-box", fontFamily: "'Syne', sans-serif" }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
        {filtrados.map(o => <CardOS key={o.id} os={o} motoboys={motoboys} onEdit={o => setModal(o)} onDelete={deletar} />)}
        {filtrados.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: G.textoMuted }}>
            <p style={{ fontSize: 32, margin: "0 0 8px" }}>📋</p>
            <p style={{ margin: 0 }}>Nenhuma OS encontrada</p>
          </div>
        )}
      </div>

      {modal && (
        <Modal titulo={modal === "novo" ? "Nova ordem de serviço" : `Editar ${modal.id}`} onClose={() => setModal(null)} wide>
          <FormOS os={modal === "novo" ? null : modal} motoboys={motoboys} clientes={clientes} historicoEnderecos={historicoEnderecos} onSave={salvarOS} onClose={() => setModal(null)} />
        </Modal>
      )}
      {confirmarDelete && (
        <Modal titulo="Excluir OS" onClose={() => setConfirmarDelete(null)}>
          <p style={{ color: G.textoMuted, fontSize: 14, margin: "0 0 20px" }}>Excluir <strong style={{ color: G.texto }}>{confirmarDelete}</strong>?</p>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => setConfirmarDelete(null)} variant="ghost" style={{ flex: 1 }}>Cancelar</Btn>
            <Btn onClick={confirmarDeletar} variant="danger" style={{ flex: 1 }}>Excluir</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── PAINEL CLIENTES ──────────────────────────────────────────────
const PainelClientes = ({ clientes, setClientes }) => {
  const [modal, setModal] = useState(null);
  const [confirmarDelete, setConfirmarDelete] = useState(null);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState({ nome: "", telefone: "", enderecos: [""] });

  const abrirNovo = () => { setForm({ nome: "", telefone: "", enderecos: [""] }); setModal("novo"); };
  const abrirEditar = c => { setForm({ ...c, enderecos: [...c.enderecos] }); setModal("editar"); };
  const salvar = () => {
    const enderecos = form.enderecos.filter(e => e.trim());
    if (modal === "novo") { const id = Math.max(0, ...clientes.map(c => c.id)) + 1; setClientes(p => [...p, { ...form, id, enderecos }]); }
    else setClientes(p => p.map(c => c.id === form.id ? { ...form, enderecos } : c));
    setModal(null);
  };
  const confirmarDeletar = () => { setClientes(p => p.filter(c => c.id !== confirmarDelete)); setConfirmarDelete(null); };
  const addEnd = () => setForm(p => ({ ...p, enderecos: [...p.enderecos, ""] }));
  const updEnd = (i, v) => setForm(p => { const e = [...p.enderecos]; e[i] = v; return { ...p, enderecos: e }; });
  const remEnd = i => setForm(p => ({ ...p, enderecos: p.enderecos.filter((_, idx) => idx !== i) }));

  const filtrados = clientes.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, color: G.texto, fontSize: 20, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>Clientes</h2>
          <p style={{ margin: 0, color: G.textoMuted, fontSize: 13 }}>{clientes.length} cadastrados</p>
        </div>
        <Btn onClick={abrirNovo}>+ Novo cliente</Btn>
      </div>
      <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente..."
        style={{ width: "100%", background: G.superficie, border: `1px solid ${G.borda}`, borderRadius: 8, padding: "10px 14px", color: G.texto, fontSize: 13, outline: "none", marginBottom: 16, boxSizing: "border-box", fontFamily: "'Syne', sans-serif" }} />
      {filtrados.length === 0 && <div style={{ textAlign: "center", padding: 60, color: G.textoMuted }}><p style={{ fontSize: 32, margin: "0 0 8px" }}>👥</p><p style={{ margin: 0 }}>Nenhum cliente cadastrado</p></div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {filtrados.map(c => (
          <div key={c.id} style={{ background: G.superficie, border: `1px solid ${G.borda}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: G.laranja + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: G.laranja, fontFamily: "'Syne', sans-serif", flexShrink: 0 }}>
                {c.nome.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, color: G.texto, fontSize: 14, fontFamily: "'Syne', sans-serif" }}>{c.nome}</p>
                <p style={{ margin: 0, fontSize: 12, color: G.textoMuted }}>{c.telefone}</p>
              </div>
            </div>
            {c.enderecos.length > 0 && (
              <div style={{ background: G.superficie2, borderRadius: 8, padding: "8px 10px", marginBottom: 12 }}>
                {c.enderecos.map((e, i) => <p key={i} style={{ margin: i === 0 ? 0 : "4px 0 0", fontSize: 12, color: G.textoMuted }}>📍 {e}</p>)}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => abrirEditar(c)} variant="ghost" size="sm" style={{ flex: 1 }}>✏ Editar</Btn>
              <Btn onClick={() => { const tel = c.telefone.replace(/\D/g, ""); window.open(`https://wa.me/55${tel}`, "_blank"); }} variant="success" size="sm" style={{ flex: 1 }}>WhatsApp</Btn>
              <Btn onClick={() => setConfirmarDelete(c.id)} variant="danger" size="sm">✕</Btn>
            </div>
          </div>
        ))}
      </div>
      {(modal === "novo" || modal === "editar") && (
        <Modal titulo={modal === "novo" ? "Novo cliente" : "Editar cliente"} onClose={() => setModal(null)}>
          <Input label="Nome / empresa" value={form.nome} onChange={v => setForm(p => ({ ...p, nome: v }))} placeholder="Nome completo ou razão social" />
          <Input label="Telefone / WhatsApp" value={form.telefone} onChange={v => setForm(p => ({ ...p, telefone: v }))} placeholder="(31) 99999-9999" />
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: G.textoMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>Endereços frequentes</label>
              <button type="button" onClick={addEnd} style={{ fontSize: 12, color: G.laranja, background: "transparent", border: `1px solid ${G.laranja}44`, borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>+ Adicionar</button>
            </div>
            {form.enderecos.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input value={e} onChange={ev => updEnd(i, ev.target.value)} placeholder="Endereço completo"
                  style={{ flex: 1, background: G.superficie2, border: `1px solid ${G.borda}`, borderRadius: 8, padding: "9px 12px", color: G.texto, fontSize: 13, outline: "none", fontFamily: "'Syne', sans-serif" }} />
                {form.enderecos.length > 1 && <button type="button" onClick={() => remEnd(i)} style={{ background: G.perigo + "22", border: "none", color: G.perigo, borderRadius: 8, padding: "0 10px", cursor: "pointer" }}>✕</button>}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => setModal(null)} variant="ghost" style={{ flex: 1 }}>Cancelar</Btn>
            <Btn onClick={salvar} style={{ flex: 2 }}>{modal === "novo" ? "Cadastrar" : "Salvar"}</Btn>
          </div>
        </Modal>
      )}
      {confirmarDelete && (
        <Modal titulo="Remover cliente" onClose={() => setConfirmarDelete(null)}>
          <p style={{ color: G.textoMuted, fontSize: 14, margin: "0 0 20px" }}>Remover <strong style={{ color: G.texto }}>{clientes.find(c => c.id === confirmarDelete)?.nome}</strong>?</p>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => setConfirmarDelete(null)} variant="ghost" style={{ flex: 1 }}>Cancelar</Btn>
            <Btn onClick={confirmarDeletar} variant="danger" style={{ flex: 1 }}>Remover</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── PAINEL MOTOBOYS ──────────────────────────────────────────────
const FormMotoboy = ({ mb, onSave, onClose }) => {
  const [form, setForm] = useState(mb || { nome: "", telefone: "", moto: "", status: "disponivel" });
  const f = k => v => setForm(p => ({ ...p, [k]: v }));
  return (
    <div>
      <Input label="Nome completo" value={form.nome} onChange={f("nome")} placeholder="Nome do motoboy" />
      <Input label="Telefone / WhatsApp" value={form.telefone} onChange={f("telefone")} placeholder="(31) 99999-9999" />
      <Input label="Moto e placa" value={form.moto} onChange={f("moto")} placeholder="Ex: Honda CG 160 • ABC-1234" />
      {mb && <Select label="Status" value={form.status} onChange={f("status")} options={Object.entries(STATUS_MOTOBOY).map(([k, v]) => ({ value: k, label: v.label }))} />}
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <Btn onClick={onClose} variant="ghost" style={{ flex: 1 }}>Cancelar</Btn>
        <Btn onClick={() => onSave(form)} style={{ flex: 2 }}>{mb ? "Salvar" : "Cadastrar"}</Btn>
      </div>
    </div>
  );
};

const PainelMotoboys = ({ motoboys, setMotoboys, os }) => {
  const [modal, setModal] = useState(null);
  const [confirmarDelete, setConfirmarDelete] = useState(null);

  const salvar = form => {
    if (modal === "novo") {
      const id = Math.max(0, ...motoboys.map(m => m.id)) + 1;
      const foto = form.nome.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase();
      setMotoboys(p => [...p, { ...form, id, entregas_hoje: 0, foto }]);
    } else setMotoboys(p => p.map(m => m.id === form.id ? { ...m, ...form } : m));
    setModal(null);
  };
  const confirmarDeletar = () => { setMotoboys(p => p.filter(m => m.id !== confirmarDelete)); setConfirmarDelete(null); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, color: G.texto, fontSize: 20, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>Motoboys</h2>
          <p style={{ margin: 0, color: G.textoMuted, fontSize: 13 }}>{motoboys.length} cadastrados</p>
        </div>
        <Btn onClick={() => setModal("novo")}>+ Cadastrar</Btn>
      </div>
      {motoboys.length === 0 && <div style={{ textAlign: "center", padding: 60, color: G.textoMuted }}><p style={{ fontSize: 32, margin: "0 0 8px" }}>🏍️</p><p style={{ margin: 0 }}>Nenhum motoboy cadastrado</p></div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {motoboys.map(mb => {
          const st = STATUS_MOTOBOY[mb.status];
          const osAtiva = os.find(o => o.motoboy_id === mb.id && ["aguardando_coleta", "em_rota"].includes(o.status));
          return (
            <div key={mb.id} style={{ background: G.superficie, border: `1px solid ${G.borda}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12 }}>
                <Avatar iniciais={mb.foto} size={46} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: G.texto, fontSize: 14, fontFamily: "'Syne', sans-serif" }}>{mb.nome}</p>
                  <p style={{ margin: "2px 0 6px", color: G.textoMuted, fontSize: 12 }}>{mb.moto}</p>
                  <Badge cor={st.cor}>{st.label}</Badge>
                </div>
              </div>
              {osAtiva && (
                <div style={{ background: G.atencao + "15", border: `1px solid ${G.atencao}33`, borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 11, color: G.atencao, fontWeight: 700 }}>EM OPERAÇÃO</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: G.textoMuted }}>{osAtiva.id} — {osAtiva.cliente}</p>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: `1px solid ${G.borda}`, borderBottom: `1px solid ${G.borda}`, marginBottom: 12 }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 20, color: G.texto, fontFamily: "'Syne', sans-serif" }}>{mb.entregas_hoje}</p>
                  <p style={{ margin: 0, fontSize: 11, color: G.textoMuted }}>Hoje</p>
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 20, color: G.texto, fontFamily: "'Syne', sans-serif" }}>{os.filter(o => o.motoboy_id === mb.id).length}</p>
                  <p style={{ margin: 0, fontSize: 11, color: G.textoMuted }}>OS total</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={() => setModal({ ...mb })} variant="ghost" size="sm" style={{ flex: 1 }}>✏ Editar</Btn>
                <Btn onClick={() => { const tel = mb.telefone.replace(/\D/g, ""); window.open(`https://wa.me/55${tel}`, "_blank"); }} variant="success" size="sm" style={{ flex: 1 }}>WhatsApp</Btn>
                <Btn onClick={() => setConfirmarDelete(mb.id)} variant="danger" size="sm">✕</Btn>
              </div>
            </div>
          );
        })}
      </div>
      {modal && (
        <Modal titulo={modal === "novo" ? "Cadastrar motoboy" : "Editar motoboy"} onClose={() => setModal(null)}>
          <FormMotoboy mb={modal === "novo" ? null : modal} onSave={salvar} onClose={() => setModal(null)} />
        </Modal>
      )}
      {confirmarDelete && (
        <Modal titulo="Remover motoboy" onClose={() => setConfirmarDelete(null)}>
          <p style={{ color: G.textoMuted, fontSize: 14, margin: "0 0 20px" }}>Remover <strong style={{ color: G.texto }}>{motoboys.find(m => m.id === confirmarDelete)?.nome}</strong>?</p>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => setConfirmarDelete(null)} variant="ghost" style={{ flex: 1 }}>Cancelar</Btn>
            <Btn onClick={confirmarDeletar} variant="danger" style={{ flex: 1 }}>Remover</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── DASHBOARD ────────────────────────────────────────────────────
const Dashboard = ({ os, motoboys }) => {
  const entregues = os.filter(o => o.status === "entregue");
  const emRota = os.filter(o => ["em_rota", "aguardando_coleta"].includes(o.status));
  const aguardando = os.filter(o => o.status === "aguardando");
  const faturamento = entregues.reduce((acc, o) => acc + Number(o.valor || 0), 0);
  const disponiveis = motoboys.filter(m => m.status === "disponivel").length;
  const stats = [
    { label: "Faturamento hoje", valor: `R$ ${faturamento.toFixed(2)}`, sub: `${entregues.length} entregas concluídas`, cor: G.sucesso },
    { label: "Em operação", valor: emRota.length, sub: "ordens em andamento", cor: G.info },
    { label: "Aguardando atribuição", valor: aguardando.length, sub: "precisam de motoboy", cor: G.atencao },
    { label: "Motoboys disponíveis", valor: disponiveis, sub: `de ${motoboys.length} cadastrados`, cor: G.laranja },
  ];
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 4px", color: G.texto, fontSize: 20, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>Visão geral</h2>
        <p style={{ margin: 0, color: G.textoMuted, fontSize: 13 }}>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background: G.superficie, border: `1px solid ${G.borda}`, borderRadius: 12, padding: 18, borderTop: `3px solid ${s.cor}` }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: G.textoMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{s.label}</p>
            <p style={{ margin: "8px 0 4px", fontSize: 28, fontWeight: 800, color: s.cor, fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>{s.valor}</p>
            <p style={{ margin: 0, fontSize: 12, color: G.textoMuted }}>{s.sub}</p>
          </div>
        ))}
      </div>
      {os.length === 0 && motoboys.length === 0 ? (
        <div style={{ background: G.superficie, border: `1px solid ${G.borda}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
          <p style={{ fontSize: 36, margin: "0 0 12px" }}>🏍️</p>
          <p style={{ margin: "0 0 6px", fontWeight: 700, color: G.texto, fontSize: 16, fontFamily: "'Syne', sans-serif" }}>Sistema pronto para uso</p>
          <p style={{ margin: 0, color: G.textoMuted, fontSize: 13 }}>Cadastre motoboys e clientes, depois crie sua primeira OS.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ background: G.superficie, border: `1px solid ${G.borda}`, borderRadius: 12, padding: 16 }}>
            <p style={{ margin: "0 0 14px", fontWeight: 700, color: G.texto, fontSize: 14, fontFamily: "'Syne', sans-serif" }}>OS recentes</p>
            {os.length === 0 ? <p style={{ color: G.textoMuted, fontSize: 13 }}>Nenhuma OS criada</p> : os.slice(-5).reverse().map(o => {
              const st = STATUS_OS[o.status];
              const mb = motoboys.find(m => m.id === o.motoboy_id);
              return (
                <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${G.borda}` }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: st.cor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: G.texto, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.cliente}</p>
                    <p style={{ margin: 0, fontSize: 11, color: G.textoMuted }}>{mb ? mb.nome : "Sem motoboy"} • {o.criado_em}</p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: G.sucesso, whiteSpace: "nowrap" }}>R$ {Number(o.valor || 0).toFixed(2)}</span>
                </div>
              );
            })}
          </div>
          <div style={{ background: G.superficie, border: `1px solid ${G.borda}`, borderRadius: 12, padding: 16 }}>
            <p style={{ margin: "0 0 14px", fontWeight: 700, color: G.texto, fontSize: 14, fontFamily: "'Syne', sans-serif" }}>Status da frota</p>
            {motoboys.length === 0 ? <p style={{ color: G.textoMuted, fontSize: 13 }}>Nenhum motoboy cadastrado</p> : motoboys.map(mb => {
              const st = STATUS_MOTOBOY[mb.status];
              const osAtiva = os.find(o => o.motoboy_id === mb.id && ["aguardando_coleta", "em_rota"].includes(o.status));
              return (
                <div key={mb.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${G.borda}` }}>
                  <Avatar iniciais={mb.foto} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: G.texto }}>{mb.nome}</p>
                    <p style={{ margin: 0, fontSize: 11, color: G.textoMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{osAtiva ? `${osAtiva.id} — ${osAtiva.cliente}` : "Sem OS ativa"}</p>
                  </div>
                  <Badge cor={st.cor}>{st.label}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── INTERFACE MOTOBOY ────────────────────────────────────────────
const InterfaceMotoboy = ({ motoboys, os, setOs, onLogout }) => {
  const [mbSelecionado, setMbSelecionado] = useState(null);
  const [tab, setTab] = useState("minhas");

  if (!mbSelecionado) {
    const ativos = motoboys.filter(m => m.status !== "inativo");
    return (
      <div style={{ background: G.preto, minHeight: "100vh", padding: 20, display: "flex", flexDirection: "column" }}>
        <div style={{ textAlign: "center", padding: "40px 0 32px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div style={{ width: 42, height: 42, background: G.laranja, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🏍️</div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, color: G.texto }}>Moto Service BH</span>
          </div>
          <h2 style={{ color: G.texto, fontFamily: "'Syne', sans-serif", fontSize: 22, margin: "0 0 8px" }}>Painel do motoboy</h2>
          <p style={{ color: G.textoMuted, fontSize: 14, margin: 0 }}>Selecione seu perfil</p>
        </div>
        {ativos.length === 0
          ? <div style={{ textAlign: "center", padding: 40, color: G.textoMuted }}><p style={{ fontSize: 13 }}>Nenhum motoboy ativo cadastrado</p></div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ativos.map(mb => {
              const st = STATUS_MOTOBOY[mb.status];
              return (
                <button key={mb.id} onClick={() => setMbSelecionado(mb)}
                  style={{ display: "flex", gap: 14, alignItems: "center", background: G.superficie, border: `1px solid ${G.borda}`, borderRadius: 14, padding: 16, cursor: "pointer", textAlign: "left" }}>
                  <Avatar iniciais={mb.foto} size={48} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, color: G.texto, fontWeight: 700, fontSize: 15, fontFamily: "'Syne', sans-serif" }}>{mb.nome}</p>
                    <p style={{ margin: "2px 0 6px", color: G.textoMuted, fontSize: 12 }}>{mb.moto}</p>
                    <Badge cor={st.cor}>{st.label}</Badge>
                  </div>
                  <span style={{ color: G.textoMuted, fontSize: 20 }}>›</span>
                </button>
              );
            })}
          </div>
        }
        <div style={{ marginTop: "auto", paddingTop: 20, textAlign: "center" }}>
          <Btn onClick={onLogout} variant="ghost" size="sm">← Voltar ao admin</Btn>
        </div>
      </div>
    );
  }

  const mb = mbSelecionado;
  const ativas = os.filter(o => o.motoboy_id === mb.id && ["aguardando_coleta", "em_rota"].includes(o.status));
  const concluidas = os.filter(o => o.motoboy_id === mb.id && o.status === "entregue");
  const atualizarStatus = (id, status) => setOs(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  const ACOES = {
    aguardando_coleta: { label: "Confirmar coleta realizada", proximo: "em_rota", cor: G.info },
    em_rota: { label: "Confirmar entrega realizada", proximo: "entregue", cor: G.sucesso },
  };

  return (
    <div style={{ background: G.preto, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ background: G.superficie, borderBottom: `1px solid ${G.borda}`, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar iniciais={mb.foto} size={40} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 700, color: G.texto, fontSize: 15, fontFamily: "'Syne', sans-serif" }}>{mb.nome}</p>
          <p style={{ margin: 0, fontSize: 12, color: G.textoMuted }}>{mb.moto}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 20, color: G.laranja, fontFamily: "'Syne', sans-serif" }}>{concluidas.length}</p>
          <p style={{ margin: 0, fontSize: 11, color: G.textoMuted }}>entregues hoje</p>
        </div>
      </div>
      <div style={{ display: "flex", background: G.superficie, borderBottom: `1px solid ${G.borda}` }}>
        {[{ k: "minhas", l: `Minhas OS (${ativas.length})` }, { k: "historico", l: `Concluídas (${concluidas.length})` }].map(({ k, l }) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "12px 8px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Syne', sans-serif", color: tab === k ? G.laranja : G.textoMuted, borderBottom: `2px solid ${tab === k ? G.laranja : "transparent"}` }}>
            {l}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {tab === "minhas" && (
          ativas.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 20px", color: G.textoMuted }}><p style={{ fontSize: 40, margin: "0 0 12px" }}>🏍️</p><p style={{ margin: 0, color: G.texto, fontWeight: 600 }}>Nenhuma OS atribuída</p></div>
            : ativas.map(o => {
              const acao = ACOES[o.status];
              return (
                <div key={o.id} style={{ background: G.superficie, border: `2px solid ${acao.cor}44`, borderRadius: 14, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 14, color: G.laranja }}>{o.id}</span>
                    <Badge cor={STATUS_OS[o.status].cor}>{STATUS_OS[o.status].label}</Badge>
                  </div>
                  <p style={{ margin: "0 0 12px", fontWeight: 700, color: G.texto, fontSize: 16, fontFamily: "'Syne', sans-serif" }}>{o.cliente}</p>
                  {o.prioridade === "urgente" && <div style={{ background: G.perigo + "20", border: `1px solid ${G.perigo}44`, borderRadius: 8, padding: "6px 10px", marginBottom: 10 }}><p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: G.perigo }}>⚡ URGENTE</p></div>}
                  <div style={{ background: G.superficie2, borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
                    {(o.paradas || []).map((p, i) => (
                      <div key={i} style={{ padding: "10px 12px", borderBottom: i < o.paradas.length - 1 ? `1px solid ${G.borda}` : "none" }}>
                        <p style={{ margin: "0 0 3px", fontSize: 10, fontWeight: 700, color: p.tipo === "coleta" ? G.laranja : G.sucesso, letterSpacing: "0.08em", textTransform: "uppercase" }}>{p.tipo}</p>
                        <p style={{ margin: 0, fontSize: 13, color: G.texto }}>{p.endereco}</p>
                      </div>
                    ))}
                  </div>
                  {(o.paradas || []).filter(p => p.lat && p.lng).length >= 2 && <MiniMapa paradas={o.paradas} />}
                  <button onClick={() => atualizarStatus(o.id, acao.proximo)}
                    style={{ width: "100%", padding: 14, background: acao.cor, border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Syne', sans-serif", marginTop: 12 }}>
                    ✓ {acao.label}
                  </button>
                </div>
              );
            })
        )}
        {tab === "historico" && (
          concluidas.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 20px", color: G.textoMuted }}><p style={{ fontSize: 13 }}>Nenhuma entrega concluída</p></div>
            : concluidas.map(o => (
              <div key={o.id} style={{ background: G.superficie, border: `1px solid ${G.borda}`, borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: G.laranja }}>{o.id}</span>
                  <Badge cor={G.sucesso}>Entregue</Badge>
                </div>
                <p style={{ margin: "0 0 4px", fontWeight: 600, color: G.texto, fontSize: 14 }}>{o.cliente}</p>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${G.borda}` }}>
                  <span style={{ fontSize: 12, color: G.textoMuted }}>{o.criado_em}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: G.sucesso }}>R$ {Number(o.valor || 0).toFixed(2)}</span>
                </div>
              </div>
            ))
        )}
      </div>
      <div style={{ background: G.superficie, borderTop: `1px solid ${G.borda}`, padding: "10px 16px", display: "flex", justifyContent: "center" }}>
        <Btn onClick={() => setMbSelecionado(null)} variant="ghost" size="sm">Trocar de motoboy</Btn>
      </div>
    </div>
  );
};

// ─── APP PRINCIPAL ────────────────────────────────────────────────
export default function App() {
  const [modo, setModo] = useState("login");
  const [adminTab, setAdminTab] = useState("dashboard");
  const [os, setOs] = useState([]);
  const [motoboys, setMotoboys] = useState([]);
  const [clientes, setClientes] = useState([]);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  if (modo === "login") {
    return (
      <div style={{ background: G.preto, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
            <div style={{ width: 50, height: 50, background: G.laranja, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🏍️</div>
            <div style={{ textAlign: "left" }}>
              <p style={{ margin: 0, fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: G.texto }}>Moto Service BH</p>
              <p style={{ margin: 0, fontSize: 12, color: G.textoMuted }}>Gestão de frotas</p>
            </div>
          </div>
          <h1 style={{ color: G.texto, fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 26, margin: "0 0 8px" }}>Bem-vindo</h1>
          <p style={{ color: G.textoMuted, fontSize: 14, margin: "0 0 36px" }}>Como deseja entrar?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button onClick={() => setModo("admin")}
              style={{ padding: "18px 24px", background: G.laranja, border: "none", borderRadius: 14, color: "#fff", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 26 }}>🖥️</span>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, fontFamily: "'Syne', sans-serif" }}>Painel administrativo</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.85 }}>Gestão completa de OS e frota</p>
              </div>
            </button>
            <button onClick={() => setModo("motoboy")}
              style={{ padding: "18px 24px", background: G.superficie, border: `1px solid ${G.borda}`, borderRadius: 14, color: G.texto, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 26 }}>🏍️</span>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, fontFamily: "'Syne', sans-serif" }}>Sou motoboy</p>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: G.textoMuted }}>Ver e atualizar minhas entregas</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (modo === "motoboy") {
    return <InterfaceMotoboy motoboys={motoboys} os={os} setOs={setOs} onLogout={() => setModo("login")} />;
  }

  const TABS = [
    { k: "dashboard", label: "Dashboard", icon: "📊" },
    { k: "os", label: "Ordens de serviço", icon: "📋" },
    { k: "clientes", label: "Clientes", icon: "👥" },
    { k: "motoboys", label: "Motoboys", icon: "🏍️" },
  ];

  return (
    <div style={{ background: G.preto, minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Syne', sans-serif" }}>
      <div style={{ background: G.superficie, borderBottom: `1px solid ${G.borda}`, padding: "0 24px", display: "flex", alignItems: "center", height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: "auto" }}>
          <div style={{ width: 32, height: 32, background: G.laranja, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏍️</div>
          <span style={{ fontWeight: 800, fontSize: 15, color: G.texto }}>Moto Service BH</span>
          <span style={{ fontSize: 11, color: G.textoMuted, background: G.borda, padding: "2px 8px", borderRadius: 20 }}>Admin</span>
        </div>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setAdminTab(t.k)}
            style={{ padding: "0 16px", height: 56, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Syne', sans-serif", color: adminTab === t.k ? G.laranja : G.textoMuted, borderBottom: `2px solid ${adminTab === t.k ? G.laranja : "transparent"}`, whiteSpace: "nowrap" }}>
            <span style={{ marginRight: 6 }}>{t.icon}</span>{t.label}
          </button>
        ))}
        <div style={{ marginLeft: 16 }}>
          <Btn onClick={() => setModo("login")} variant="ghost" size="sm">Sair</Btn>
        </div>
      </div>
      <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        {adminTab === "dashboard" && <Dashboard os={os} motoboys={motoboys} />}
        {adminTab === "os" && <PainelOS os={os} setOs={setOs} motoboys={motoboys} clientes={clientes} />}
        {adminTab === "clientes" && <PainelClientes clientes={clientes} setClientes={setClientes} />}
        {adminTab === "motoboys" && <PainelMotoboys motoboys={motoboys} setMotoboys={setMotoboys} os={os} />}
      </div>
    </div>
  );
}
