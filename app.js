(function () {
  'use strict';
  var AREAS = { casa: 'Casa', trabajo: 'Trabajo', super: 'Súper' };
  var CLAVES = Object.keys(AREAS);
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var KEY = 'pendientes.v1';

  var items = [];
  var filtro = 'todos';
  var areaNueva = 'casa';
  var areaManual = false;
  var abierto = null;
  var confirmandoBorrar = null;
  var verHechos = false;

  var $ = function (id) { return document.getElementById(id); };
  var iso = Parser.iso;

  /* ---------- guardado ---------- */
  function cargar() {
    try { items = JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { items = []; }
  }
  function guardar() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { toast('No se pudo guardar en este celular.'); }
  }
  function nuevoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ---------- utilidades ---------- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function hoyDia() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function aFecha(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function difDias(s) { return Math.round((aFecha(s) - hoyDia()) / 86400000); }
  function etiqueta(s) { var d = aFecha(s); return DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()]; }
  function rangoTexto(it) {
    if (!it.desde) return '';
    if (!it.hasta || it.hasta === it.desde) return etiqueta(it.desde);
    var a = aFecha(it.desde), b = aFecha(it.hasta);
    if (a.getMonth() === b.getMonth()) return a.getDate() + ' → ' + b.getDate() + ' ' + MESES[b.getMonth()];
    return a.getDate() + ' ' + MESES[a.getMonth()] + ' → ' + b.getDate() + ' ' + MESES[b.getMonth()];
  }
  function plural(n, s, p) { return n + ' ' + (n === 1 ? s : p); }

  // 'vencido' | 'hoy' | 'proximo' | 'sin'  (un rango está "en curso" mientras hoy cae dentro)
  function situacion(it) {
    if (!it.desde) return 'sin';
    var fin = it.hasta || it.desde;
    if (difDias(fin) < 0) return 'vencido';
    if (difDias(it.desde) <= 0) return 'hoy';
    return 'proximo';
  }
  function cuando(it) {
    var s = situacion(it);
    var fin = it.hasta || it.desde;
    if (s === 'vencido') { var n = -difDias(fin); return n === 1 ? 'Venció ayer' : 'Venció hace ' + n + ' días'; }
    if (s === 'hoy') return it.hasta && it.hasta !== it.desde ? 'En curso · hasta ' + etiqueta(it.hasta) : 'Hoy';
    var d = difDias(it.desde);
    var base = d === 1 ? 'Mañana' : 'En ' + d + ' días';
    return base + ' · ' + rangoTexto(it);
  }

  /* ---------- mensajes ---------- */
  var toastH = null;
  function toast(msg, accion, fn) {
    var t = $('toast');
    t.textContent = '';
    t.appendChild(el('span', '', msg));
    if (accion) {
      var b = el('button', '', accion);
      b.type = 'button';
      b.addEventListener('click', function () { t.classList.remove('visible'); fn(); });
      t.appendChild(b);
    }
    t.classList.add('visible');
    clearTimeout(toastH);
    toastH = setTimeout(function () { t.classList.remove('visible'); }, accion ? 7000 : 3200);
  }

  /* ---------- altas, cambios y bajas ---------- */
  function agregarItem(d) {
    var it = { id: nuevoId(), titulo: d.titulo, area: d.area, desde: d.desde || null, hasta: d.hasta || null, hecho: false, hechoEn: null, creado: Date.now() };
    items.push(it);
    guardar();
    return it;
  }
  function describir(it) {
    var partes = [AREAS[it.area]];
    if (it.desde) partes.push(rangoTexto(it));
    return it.titulo + ' · ' + partes.join(' · ');
  }
  function agregarDeTexto(texto, explicito) {
    var r = Parser.parsear(texto, new Date(), areaNueva);
    var d = { titulo: r.titulo, area: r.area, desde: r.desde, hasta: r.hasta };
    if (explicito) {
      if (explicito.desde) { d.desde = explicito.desde; d.hasta = explicito.hasta || null; }
      if (explicito.areaManual) d.area = explicito.area;
    }
    if (d.hasta && d.desde && d.hasta < d.desde) { var x = d.desde; d.desde = d.hasta; d.hasta = x; }
    if (d.hasta === d.desde) d.hasta = null;
    var it = agregarItem(d);
    render();
    toast('Anotado: ' + describir(it), 'Deshacer', function () {
      items = items.filter(function (i) { return i.id !== it.id; });
      guardar(); render();
    });
    return it;
  }
  function actualizar(it, cambios) {
    Object.keys(cambios).forEach(function (k) { it[k] = cambios[k]; });
    guardar();
  }
  function marcar(it) {
    var pasaAHecho = !it.hecho;
    actualizar(it, { hecho: pasaAHecho, hechoEn: pasaAHecho ? Date.now() : null });
    if (pasaAHecho) toast('¡Hecho! ✓');
    render();
  }
  function borrar(it) {
    items = items.filter(function (i) { return i.id !== it.id; });
    guardar();
  }

  /* ---------- calendario (suena con la app cerrada) ---------- */
  function urlCalendario(it) {
    var ini = it.desde.replace(/-/g, '');
    var fin = iso(new Date(aFecha(it.hasta || it.desde).getTime() + 86400000 + 3600000)).replace(/-/g, '');
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(it.titulo) +
      '&dates=' + ini + '/' + fin + '&details=' + encodeURIComponent('Pendiente · ' + AREAS[it.area]);
  }

  /* ---------- dibujo ---------- */
  function chipsArea(contenedor, actual, alElegir) {
    contenedor.textContent = '';
    CLAVES.forEach(function (k) {
      var b = el('button', 'chip c-' + k);
      b.type = 'button';
      b.appendChild(el('i'));
      b.appendChild(document.createTextNode(AREAS[k]));
      b.setAttribute('aria-pressed', String(actual === k));
      b.addEventListener('click', function () { alElegir(k); });
      contenedor.appendChild(b);
    });
  }

  function itemEl(it) {
    var li = el('li', 'item c-' + it.area + (it.hecho ? ' hecho' : '') + (!it.hecho && situacion(it) === 'hoy' ? ' hoy' : ''));

    var chk = el('button', 'check');
    chk.type = 'button';
    chk.setAttribute('aria-label', it.hecho ? 'Volver a pendiente' : 'Marcar como hecho');
    var circ = el('span');
    circ.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>';
    chk.appendChild(circ);
    chk.addEventListener('click', function () { marcar(it); });
    li.appendChild(chk);

    var cuerpo = el('button', 'cuerpo');
    cuerpo.type = 'button';
    cuerpo.setAttribute('aria-expanded', String(abierto === it.id));
    cuerpo.appendChild(el('span', 'titulo', it.titulo));
    var meta = el('span', 'meta');
    meta.appendChild(el('span', 'pill', AREAS[it.area]));
    if (it.desde) {
      var s = situacion(it);
      var c = el('span', 'cuando' + (s === 'vencido' && !it.hecho ? ' venc' : ''), it.hecho ? rangoTexto(it) : cuando(it));
      meta.appendChild(c);
    }
    cuerpo.appendChild(meta);
    cuerpo.addEventListener('click', function () {
      abierto = abierto === it.id ? null : it.id;
      confirmandoBorrar = null;
      render();
    });
    li.appendChild(cuerpo);

    if (abierto === it.id) li.appendChild(panelEl(it));
    return li;
  }

  function panelEl(it) {
    var panel = el('div', 'panel');

    var tit = el('input');
    tit.type = 'text'; tit.value = it.titulo; tit.maxLength = 200;
    tit.setAttribute('aria-label', 'Texto del pendiente');
    tit.addEventListener('change', function () {
      var v = tit.value.trim();
      if (v) { actualizar(it, { titulo: v }); render(); }
    });
    panel.appendChild(tit);

    var chips = el('div', 'chips');
    chipsArea(chips, it.area, function (k) { actualizar(it, { area: k }); render(); });
    panel.appendChild(chips);

    var fechas = el('div', 'fechas');
    var cd = el('label', 'campo'); cd.appendChild(el('span', '', 'Desde'));
    var id1 = el('input'); id1.type = 'date'; id1.value = it.desde || '';
    cd.appendChild(id1); fechas.appendChild(cd);
    var ch = el('label', 'campo'); ch.appendChild(el('span', '', 'Hasta (opcional)'));
    var id2 = el('input'); id2.type = 'date'; id2.value = it.hasta || '';
    ch.appendChild(id2); fechas.appendChild(ch);
    function guardarFechas() {
      var d = id1.value || null, h = id2.value || null;
      if (!d && h) { d = h; h = null; }
      if (d && h && h < d) { var x = d; d = h; h = x; }
      if (h === d) h = null;
      actualizar(it, { desde: d, hasta: h });
      render();
    }
    id1.addEventListener('change', guardarFechas);
    id2.addEventListener('change', guardarFechas);
    panel.appendChild(fechas);

    var acc = el('div', 'acciones');
    if (it.desde) {
      var a = el('a', 'cal', 'Agregar al calendario');
      a.href = urlCalendario(it); a.target = '_blank'; a.rel = 'noopener';
      acc.appendChild(a);
    }
    var bb = el('button', 'borrar' + (confirmandoBorrar === it.id ? ' confirmar' : ''), confirmandoBorrar === it.id ? 'Sí, borrar' : 'Borrar');
    bb.type = 'button';
    bb.addEventListener('click', function () {
      if (confirmandoBorrar === it.id) { confirmandoBorrar = null; abierto = null; borrar(it); render(); }
      else { confirmandoBorrar = it.id; render(); }
    });
    acc.appendChild(bb);
    panel.appendChild(acc);
    return panel;
  }

  function seccion(clase, titulo, sub, lista) {
    var s = el('section', clase);
    var h = el('h2', '', titulo);
    if (sub) h.appendChild(el('span', 'sub', sub));
    s.appendChild(h);
    var ul = el('ul');
    lista.forEach(function (it) { ul.appendChild(itemEl(it)); });
    s.appendChild(ul);
    return s;
  }

  function render() {
    // formulario
    chipsArea($('chips-area'), areaNueva, function (k) { areaNueva = k; areaManual = true; render(); });

    // filtros
    var abiertos = items.filter(function (i) { return !i.hecho; });
    var f = $('filtros'); f.textContent = '';
    [['todos', 'Todos', abiertos.length]].concat(CLAVES.map(function (k) {
      return [k, AREAS[k], abiertos.filter(function (i) { return i.area === k; }).length];
    })).forEach(function (o) {
      var b = el('button', 'chip' + (o[0] !== 'todos' ? ' c-' + o[0] : ''));
      b.type = 'button';
      if (o[0] !== 'todos') b.appendChild(el('i'));
      b.appendChild(document.createTextNode(o[1] + ' '));
      b.appendChild(el('span', 'n', String(o[2])));
      b.setAttribute('aria-pressed', String(filtro === o[0]));
      b.addEventListener('click', function () {
        filtro = o[0]; abierto = null;
        if (o[0] !== 'todos' && !areaManual) areaNueva = o[0];
        render();
      });
      f.appendChild(b);
    });

    // resumen
    var venc = abiertos.filter(function (i) { return situacion(i) === 'vencido'; }).length;
    var hoy = abiertos.filter(function (i) { return situacion(i) === 'hoy'; }).length;
    var r = $('resumen'); r.textContent = '';
    if (!abiertos.length) r.textContent = 'Nada pendiente. Anotá lo que se te ocurra.';
    else {
      var partes = [];
      if (venc) partes.push('<b>' + plural(venc, 'vencido', 'vencidos') + '</b>');
      if (hoy) partes.push('<b>' + hoy + ' para hoy</b>');
      partes.push(plural(abiertos.length, 'pendiente', 'pendientes') + ' en total');
      r.innerHTML = partes.join(' · ');
    }

    // listas
    var visibles = items.filter(function (i) { return filtro === 'todos' || i.area === filtro; });
    var porFecha = function (a, b) { return (a.desde || '').localeCompare(b.desde || '') || a.creado - b.creado; };
    var abier = visibles.filter(function (i) { return !i.hecho; });
    var vencidos = abier.filter(function (i) { return situacion(i) === 'vencido'; }).sort(porFecha);
    var deHoy = abier.filter(function (i) { return situacion(i) === 'hoy'; }).sort(porFecha);
    var proximos = abier.filter(function (i) { return situacion(i) === 'proximo'; }).sort(porFecha);
    var sinFecha = abier.filter(function (i) { return situacion(i) === 'sin'; }).sort(function (a, b) { return a.creado - b.creado; });
    var hechos = visibles.filter(function (i) { return i.hecho; }).sort(function (a, b) { return (b.hechoEn || 0) - (a.hechoEn || 0); });

    var cont = $('listas'); cont.textContent = '';
    if (vencidos.length) cont.appendChild(seccion('vencidos', 'Vencidos', '', vencidos));
    if (deHoy.length) cont.appendChild(seccion('hoy', 'Hoy', '', deHoy));
    if (proximos.length) cont.appendChild(seccion('proximos', 'Próximos', '', proximos));
    if (sinFecha.length) cont.appendChild(seccion('sin', 'Sin fecha', '', sinFecha));
    if (!abier.length) {
      var v = el('div', 'vacio');
      v.appendChild(el('p', '', filtro === 'todos' ? 'No hay pendientes.' : 'No hay pendientes en ' + AREAS[filtro] + '.'));
      v.appendChild(el('p', '', 'Escribilo arriba o tocá el micrófono y decilo.'));
      cont.appendChild(v);
    }
    if (hechos.length) {
      var s = el('section', 'hechos');
      var h = el('h2', '', 'Hechos');
      h.appendChild(el('span', 'sub', String(hechos.length)));
      s.appendChild(h);
      var fila = el('div', 'acciones izq');
      var bv = el('button', 'link', verHechos ? 'Ocultar' : 'Mostrar');
      bv.type = 'button';
      bv.addEventListener('click', function () { verHechos = !verHechos; render(); });
      fila.appendChild(bv);
      if (verHechos) {
        var bq = el('button', 'link', 'Vaciar hechos');
        bq.type = 'button';
        bq.addEventListener('click', function () {
          if (!window.__confirmaVaciar) { window.__confirmaVaciar = true; bq.textContent = 'Tocá otra vez para borrar'; setTimeout(function () { window.__confirmaVaciar = false; render(); }, 4000); return; }
          window.__confirmaVaciar = false;
          items = items.filter(function (i) { return !(i.hecho && (filtro === 'todos' || i.area === filtro)); });
          guardar(); render();
        });
        fila.appendChild(bq);
      }
      s.appendChild(fila);
      if (verHechos) {
        var ul = el('ul');
        hechos.forEach(function (it) { ul.appendChild(itemEl(it)); });
        s.appendChild(ul);
      }
      cont.appendChild(s);
    }
  }

  /* ---------- formulario ---------- */
  function iniciarFormulario() {
    $('fecha').textContent = new Date().toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' });
    $('btn-rango').addEventListener('click', function () {
      var oculto = $('campo-hasta').hidden;
      $('campo-hasta').hidden = !oculto;
      $('lbl-desde').textContent = oculto ? 'Desde' : 'Fecha';
      this.textContent = oculto ? 'Quitar rango' : '+ Varios días';
      if (!oculto) $('hasta').value = '';
    });
    $('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var t = $('texto').value.trim();
      if (!t) { $('texto').focus(); return; }
      agregarDeTexto(t, { desde: $('desde').value || null, hasta: $('hasta').value || null, area: areaNueva, areaManual: areaManual });
      $('texto').value = ''; $('desde').value = ''; $('hasta').value = '';
      areaManual = false;
      if ($('campo-hasta').hidden === false) $('btn-rango').click();
    });
  }

  /* ---------- voz ---------- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = null, texto = '', cancelado = false;
  function cerrarEscucha() { $('velo').hidden = true; }
  function iniciarVoz() {
    if (!SR) return;
    $('mic').hidden = false;
    $('mic').addEventListener('click', function () {
      texto = ''; cancelado = false;
      $('dictado').textContent = 'Decí qué hay que hacer, dónde y para cuándo.';
      $('dictado').classList.remove('vivo');
      $('escucha-estado').textContent = 'Escuchando…';
      $('velo').hidden = false;
      rec = new SR();
      rec.lang = 'es-UY';
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = function (ev) {
        var fijo = '', prov = '';
        for (var i = 0; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) fijo += ev.results[i][0].transcript; else prov += ev.results[i][0].transcript;
        }
        texto = (fijo + ' ' + prov).trim();
        $('dictado').textContent = texto || '…';
        $('dictado').classList.add('vivo');
      };
      rec.onerror = function (ev) {
        cancelado = true;
        cerrarEscucha();
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') toast('Permití el micrófono para este sitio y probá de nuevo.');
        else if (ev.error === 'no-speech') toast('No te escuché. Probá de nuevo.');
        else if (ev.error !== 'aborted') toast('No pude escuchar (' + ev.error + ').');
      };
      rec.onend = function () {
        if (cancelado) return;
        cerrarEscucha();
        if (texto.trim()) agregarDeTexto(texto.trim(), null);
        else toast('No te escuché. Probá de nuevo.');
      };
      try { rec.start(); } catch (e) { cerrarEscucha(); toast('No se pudo activar el micrófono.'); }
    });
    $('escucha-listo').addEventListener('click', function () { try { rec.stop(); } catch (e) { cerrarEscucha(); } });
    $('escucha-cancelar').addEventListener('click', function () { cancelado = true; try { rec.abort(); } catch (e) {} cerrarEscucha(); });
  }

  /* ---------- avisos ---------- */
  function estadoAvisos() {
    var e = $('estado-avisos'), b = $('btn-avisos');
    if (!('Notification' in window)) { e.textContent = 'Este navegador no permite avisos.'; b.hidden = true; return; }
    b.hidden = false;
    if (Notification.permission === 'granted') { e.textContent = 'Avisos activados: te aviso de lo vencido y de lo de hoy una vez por día, al abrir la app.'; b.textContent = 'Probar aviso ahora'; }
    else if (Notification.permission === 'denied') { e.textContent = 'Los avisos están bloqueados. Activalos desde los permisos del sitio en el navegador.'; b.hidden = true; }
    else { e.textContent = 'Todavía no activaste los avisos.'; b.textContent = 'Activar avisos'; }
  }
  function urgentes() {
    return items.filter(function (i) { var s = situacion(i); return !i.hecho && (s === 'vencido' || s === 'hoy'); });
  }
  function avisar(forzar) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var hoy = iso(new Date());
    var ultimo = ''; try { ultimo = localStorage.getItem('aviso-dia') || ''; } catch (e) {}
    if (!forzar && ultimo === hoy) return;
    var l = urgentes();
    if (!l.length) { if (forzar) toast('No tenés nada vencido ni para hoy.'); return; }
    var cuerpo = l.slice(0, 4).map(function (i) { return '• ' + i.titulo; }).join('\n') + (l.length > 4 ? '\n… y ' + (l.length - 4) + ' más' : '');
    var titulo = plural(l.length, 'pendiente para hoy', 'pendientes para hoy');
    var opc = { body: cuerpo, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'pendientes-dia' };
    var mostrar = function (reg) { if (reg && reg.showNotification) reg.showNotification(titulo, opc); else new Notification(titulo, opc); };
    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then(mostrar, function () { mostrar(null); });
    else mostrar(null);
    try { localStorage.setItem('aviso-dia', hoy); } catch (e) {}
  }
  function iniciarAjustes() {
    $('btn-ajustes').addEventListener('click', function () { estadoAvisos(); $('velo-ajustes').hidden = false; });
    $('cerrar-ajustes').addEventListener('click', function () { $('velo-ajustes').hidden = true; $('caja-respaldo').hidden = true; });
    $('btn-avisos').addEventListener('click', function () {
      if (Notification.permission === 'granted') { avisar(true); return; }
      Notification.requestPermission().then(function () { estadoAvisos(); avisar(true); });
    });
    $('btn-copiar').addEventListener('click', function () {
      var datos = JSON.stringify({ app: 'pendientes', version: 1, items: items });
      var caja = $('caja-respaldo');
      var mostrarCaja = function () { caja.hidden = false; caja.value = datos; caja.focus(); caja.select(); toast('Copiá el texto de la caja y guardalo.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(datos).then(function () { toast('Respaldo copiado.'); }, mostrarCaja);
      else mostrarCaja();
    });
    $('btn-pegar').addEventListener('click', function () {
      var caja = $('caja-respaldo');
      if (caja.hidden) { caja.hidden = false; caja.value = ''; caja.focus(); return; }
      try {
        var d = JSON.parse(caja.value);
        var ids = {}; items.forEach(function (i) { ids[i.id] = true; });
        var nuevos = (d.items || []).filter(function (i) { return i && i.id && i.titulo && !ids[i.id]; });
        items = items.concat(nuevos); guardar(); render();
        caja.hidden = true; toast('Restaurados ' + plural(nuevos.length, 'pendiente', 'pendientes') + '.');
      } catch (e) { toast('Ese texto no parece un respaldo.'); }
    });
  }

  /* ---------- arranque ---------- */
  cargar();
  iniciarFormulario();
  iniciarVoz();
  iniciarAjustes();
  render();
  setTimeout(function () { avisar(false); }, 1200);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { render(); avisar(false); }
  });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  window.__app = { items: function () { return items; }, agregarDeTexto: agregarDeTexto, render: render };
})();
