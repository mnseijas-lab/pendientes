/* Entiende frases dichas o escritas en español rioplatense:
   "hay que comprar leche en el súper para el viernes"
   -> { titulo, area, desde, hasta }  (fechas 'AAAA-MM-DD', hasta solo si es un rango) */
(function (root) {
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  var MES_RE = '(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)';
  var DIA_RE = '(?:domingo|lunes|martes|miercoles|jueves|viernes|sabado)';

  function norm(s) {
    // Normaliza letra por letra (sin tildes, minúsculas) para conservar los mismos índices que el texto original.
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      out += c.length === 1 ? c : ' ';
    }
    return out;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dia0(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function suma(d, n) { var x = dia0(d); x.setDate(x.getDate() + n); return x; }
  function mesNum(nombre) { return nombre === 'setiembre' ? 8 : MESES.indexOf(nombre); }

  // Día + mes (+ año opcional) -> fecha. Si ya pasó este año, pasa al año siguiente.
  function diaMes(d, m, y, hoy) {
    var anio = y ? (y < 100 ? 2000 + y : y) : hoy.getFullYear();
    var f = new Date(anio, m, d);
    if (!y && f < hoy) f = new Date(anio + 1, m, d);
    return f;
  }
  function proximoDiaSemana(idx, hoy) {
    var delta = (idx - hoy.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    return suma(hoy, delta);
  }

  // Convierte una pieza de fecha ("25", "25/11", "3 de diciembre", "viernes", "mañana") en Date.
  function pieza(tok, hoy, mesDef, anioDef) {
    var m;
    tok = tok.trim();
    if ((m = tok.match(/^(\d{1,2}) de (\w+)(?: de (\d{4}))?$/))) return diaMes(+m[1], mesNum(m[2]), m[3] ? +m[3] : null, hoy);
    if ((m = tok.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/))) return diaMes(+m[1], +m[2] - 1, m[3] ? +m[3] : null, hoy);
    if ((m = tok.match(/^(\d{1,2})$/))) {
      if (mesDef != null) return new Date(anioDef, mesDef, +m[1]);
      var f = new Date(hoy.getFullYear(), hoy.getMonth(), +m[1]);
      if (f < hoy) f = new Date(hoy.getFullYear(), hoy.getMonth() + 1, +m[1]);
      return f;
    }
    if (tok === 'hoy') return hoy;
    if (tok === 'manana') return suma(hoy, 1);
    if (tok === 'pasado manana') return suma(hoy, 2);
    var di = DIAS.indexOf(tok);
    if (di >= 0) return proximoDiaSemana(di, hoy);
    return null;
  }

  function parsear(texto, hoyIn, areaPorDefecto) {
    var hoy = dia0(hoyIn || new Date());
    var orig = String(texto || '').trim();
    var n = norm(orig);
    var cortes = [];
    var desde = null, hasta = null, area = null;

    function quitar(i, largo) {
      cortes.push([i, i + largo]);
      n = n.slice(0, i) + new Array(largo + 1).join(' ') + n.slice(i + largo);
    }
    function buscar(re) {
      var m = re.exec(n);
      if (m) quitar(m.index, m[0].length);
      return m;
    }

    var PIEZA = '(?:\\d{1,2} de ' + MES_RE + '(?: de \\d{4})?|\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?|\\d{1,2}|' + DIA_RE + '|hoy|pasado manana|manana)';

    // ---------- fechas ----------
    var m;
    // rango: "del 20 al 25 de diciembre", "entre el lunes y el viernes", "desde el 3/12 hasta el 10/12"
    var reRango = new RegExp('\\b(?:del|desde el|desde|entre el|entre)\\s+(' + PIEZA + ')\\s+(?:al|hasta el|hasta|y el|y)\\s+(' + PIEZA + ')(?![\\w/])');
    if ((m = buscar(reRango))) {
      var b = pieza(m[2], hoy, null, null);
      var mesB = /\d/.test(m[2]) && / de |\//.test(m[2]) ? b.getMonth() : null;
      var a = pieza(m[1], hoy, mesB != null ? b.getMonth() : null, b.getFullYear());
      if (a && b && DIAS.indexOf(m[1].trim()) >= 0 && DIAS.indexOf(m[2].trim()) >= 0) {
        // "del lunes al viernes": el segundo día es el primero que viene después del primero
        b = suma(a, ((DIAS.indexOf(m[2].trim()) - a.getDay() + 7) % 7) || 7);
      }
      if (a && b && a > b && mesB != null) a = new Date(b.getFullYear(), b.getMonth() - 1, a.getDate());
      if (a && b && a <= b) { desde = a; hasta = b; }
      else if (a && b) { desde = b; hasta = a; }
    }
    if (!desde) {
      if ((m = buscar(/\b(?:para |hasta |antes d[eel]+ |el |de aqui a[l]? )?(\d{1,2}) de (setiembre|septiembre|enero|febrero|marzo|abril|mayo|junio|julio|agosto|octubre|noviembre|diciembre)(?: de (\d{4}))?/))) {
        desde = diaMes(+m[1], mesNum(m[2]), m[3] ? +m[3] : null, hoy);
      } else if ((m = buscar(/\b(?:para |hasta |el )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/))) {
        desde = diaMes(+m[1], +m[2] - 1, m[3] ? +m[3] : null, hoy);
      } else if ((m = buscar(/\b(?:para |hasta |antes d[eel]+ |de aqui a[l]? )?(?:el |este |proximo |el proximo )?(pasado manana|(?<!la )(?<!de la )manana|hoy)\b/))) {
        desde = pieza(m[1], hoy);
      } else if ((m = buscar(new RegExp('\\b(?:para |hasta |antes d[eel]+ )?(?:el |este |proximo |el proximo )?(' + DIA_RE + ')(?: que viene| proximo)?\\b')))) {
        desde = proximoDiaSemana(DIAS.indexOf(m[1]), hoy);
      } else if ((m = buscar(/\b(?:esta semana|en la semana)\b/))) {
        desde = hoy; hasta = suma(hoy, (7 - hoy.getDay()) % 7);
        if (iso(hasta) === iso(hoy)) hasta = null;
      } else if ((m = buscar(/\b(?:la semana que viene|la proxima semana|proxima semana|semana proxima)\b/))) {
        var lunes = proximoDiaSemana(1, hoy);
        desde = lunes; hasta = suma(lunes, 6);
      } else if ((m = buscar(/\b(?:a )?fin(?:es)? de mes\b/))) {
        desde = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        if (desde < hoy) desde = hoy;
      } else if ((m = buscar(/\b(?:para )?(?:en|dentro de) (\d{1,2}|un|una|dos|tres|cuatro|cinco) (dias?|semanas?|meses|mes)\b/))) {
        var pal = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };
        var cant = pal[m[1]] || +m[1];
        if (/^dia/.test(m[2])) desde = suma(hoy, cant);
        else if (/^semana/.test(m[2])) desde = suma(hoy, 7 * cant);
        else desde = new Date(hoy.getFullYear(), hoy.getMonth() + cant, hoy.getDate());
      } else if ((m = buscar(/\b(?:para el |para |hasta el |el dia |el )(\d{1,2})(?![\d\/:])(?! (?:de|kilos?|litros?|personas?|unidades?|pesos|horas))\b/))) {
        if (+m[1] >= 1 && +m[1] <= 31) desde = pieza(m[1], hoy, null, null);
      }
    }

    // ---------- área ----------
    var AREA_EXPL = [
      ['super', /\b(?:en|del|de|al|para|por)\s+(?:el\s+|la\s+)?(?:super(?:mercado)?|almacen|hiper|tienda)\b/],
      ['trabajo', /\b(?:en|del|de|al|para)\s+(?:el\s+|la\s+)?(?:trabajo|oficina|laburo|facultad|curso|clase|clases)\b/],
      ['casa', /\b(?:en|de|para)\s+(?:la\s+)?(?:casa|hogar)\b/]
    ];
    for (var i = 0; i < AREA_EXPL.length && !area; i++) {
      var me = AREA_EXPL[i][1].exec(n);
      if (me) { area = AREA_EXPL[i][0]; quitar(me.index, me[0].length); }
    }
    if (!area) {
      var KW = {
        super: /\b(?:super|supermercado|comprar|compras?|almacen|faltan?|falta)\b/g,
        trabajo: /\b(?:trabajo|oficina|laburo|facultad|clases?|alumnos?|reunion|cliente|informe|jefe|entrega|parciales?|practico)\b/g,
        casa: /\b(?:casa|hogar|limpiar|lavar|arreglar|plomero|cocina|bano|ropa|pieza|jardin|patio|pagar la luz|veterinari[ao])\b/g
      };
      var mejor = null, max = 0;
      Object.keys(KW).forEach(function (k) {
        var c = (n.match(KW[k]) || []).length;
        if (c > max) { max = c; mejor = k; }
      });
      area = mejor || areaPorDefecto || 'casa';
    }

    // ---------- título ----------
    cortes.sort(function (x, y) { return x[0] - y[0]; });
    var t = '', pos = 0;
    cortes.forEach(function (c) { t += orig.slice(pos, c[0]) + ' '; pos = c[1]; });
    t += orig.slice(pos);
    t = t.replace(/\s+/g, ' ').trim();
    var tn;
    var reLead = /^(?:(?:che|ok|mira|ahi|bueno|entonces|y|tambien|ademas)[ ,]+)*(?:(?:hay que|tengo que|tenemos que|necesito|necesitamos|quiero|recordame|recordarme|recordar|acordate de|acordarme de|agendar|agendame|agenda|anotar|anotame|anota|agregar|agrega|agregame|crear|crea|nuevo pendiente|pendiente|nota)[ :,]+)+/;
    tn = norm(t);
    var ml = reLead.exec(tn);
    if (ml) t = t.slice(ml[0].length).trim();
    // restos sueltos al final o al principio ("para", "el", "de", "en"...)
    for (var k = 0; k < 3; k++) {
      t = t.replace(/[\s,.;:]+$/, '').replace(/^[\s,.;:]+/, '');
      tn = norm(t);
      var mt = /(?:^|\s)(?:para|el|la|de|del|en|a|al|hasta|antes|y|que|un|una)$/.exec(tn);
      if (mt && t.length > mt[0].length) t = t.slice(0, t.length - mt[0].length);
      var mi = /^(?:que|y|de|a|para|en)\s/.exec(tn);
      if (mi && t.length > mi[0].length) t = t.slice(mi[0].length);
    }
    t = t.trim();
    if (!t) t = orig;
    t = t.charAt(0).toUpperCase() + t.slice(1);

    return { titulo: t, area: area, desde: desde ? iso(desde) : null, hasta: hasta ? iso(hasta) : null };
  }

  var api = { parsear: parsear, iso: iso };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Parser = api;
})(typeof window !== 'undefined' ? window : this);
