(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.BankCsv = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    'use strict';

    const HEADER_ALIASES = {
        date: ['fecha operacion', 'fecha de operacion', 'fecha movimiento', 'fecha', 'date', 'booking date'],
        description: ['concepto ampliado', 'descripcion', 'concepto', 'movimiento', 'detalle', 'observaciones', 'beneficiario', 'merchant', 'description'],
        amount: ['importe movimiento', 'importe', 'cantidad', 'amount'],
        debit: ['importe cargo', 'cargos', 'cargo', 'debe', 'debito', 'retirada', 'withdrawal'],
        credit: ['importe abono', 'abonos', 'abono', 'haber', 'credito', 'ingreso', 'deposit']
    };

    function normalize(value) {
        return String(value == null ? '' : value)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function parseDelimited(text, delimiter) {
        const rows = [];
        let row = [];
        let field = '';
        let quoted = false;
        const input = String(text || '').replace(/^\uFEFF/, '');

        for (let i = 0; i < input.length; i++) {
            const char = input[i];
            if (quoted) {
                if (char === '"' && input[i + 1] === '"') {
                    field += '"';
                    i++;
                } else if (char === '"') {
                    quoted = false;
                } else {
                    field += char;
                }
            } else if (char === '"') {
                quoted = true;
            } else if (char === delimiter) {
                row.push(field.trim());
                field = '';
            } else if (char === '\n') {
                row.push(field.trim());
                if (row.some(cell => cell !== '')) rows.push(row);
                row = [];
                field = '';
            } else if (char !== '\r') {
                field += char;
            }
        }

        row.push(field.trim());
        if (row.some(cell => cell !== '')) rows.push(row);
        return rows;
    }

    function aliasScore(header, kind) {
        const clean = normalize(header);
        if (!clean || clean === 'saldo' || clean.includes('saldo')) return 0;
        let best = 0;
        HEADER_ALIASES[kind].forEach(alias => {
            if (clean === alias) best = Math.max(best, 100 + alias.length);
            else if (clean.includes(alias)) best = Math.max(best, 50 + alias.length);
        });
        return best;
    }

    function findColumn(headers, kind, excluded) {
        let bestIndex = null;
        let bestScore = 0;
        headers.forEach((header, index) => {
            if (excluded && excluded.has(index)) return;
            const score = aliasScore(header, kind);
            if (score > bestScore) {
                bestScore = score;
                bestIndex = index;
            }
        });
        return bestIndex;
    }

    function inferMapping(headers) {
        const date = findColumn(headers, 'date');
        const description = findColumn(headers, 'description', new Set(date == null ? [] : [date]));
        const excluded = new Set([date, description].filter(value => value != null));
        const debit = findColumn(headers, 'debit', excluded);
        const credit = findColumn(headers, 'credit', excluded);
        const amountExcluded = new Set([...excluded, debit, credit].filter(value => value != null));
        return {
            date,
            description,
            amount: findColumn(headers, 'amount', amountExcluded),
            debit,
            credit
        };
    }

    function headerScore(row) {
        const mapping = inferMapping(row);
        let score = 0;
        if (mapping.date != null) score += 4;
        if (mapping.description != null) score += 3;
        if (mapping.amount != null) score += 4;
        if (mapping.debit != null) score += 2;
        if (mapping.credit != null) score += 2;
        return score + Math.min(row.length, 10) / 100;
    }

    function detectRows(inputRows) {
        const rows = (inputRows || []).map(row => Array.isArray(row) ? row : [row]);
        let best = null;
        rows.slice(0, 25).forEach((row, headerIndex) => {
            if (row.length < 2) return;
            const score = headerScore(row);
            const candidate = { rows, headerIndex, headers: row.map(value => String(value == null ? '' : value)), score };
            if (!best || candidate.score > best.score || (candidate.score === best.score && row.length > best.headers.length)) best = candidate;
        });
        if (!best || best.score < 7) throw new Error('No se reconoce una fila de cabeceras con fecha, concepto e importe.');
        best.mapping = inferMapping(best.headers);
        return best;
    }

    function detectStructure(text) {
        let best = null;
        [';', ',', '\t', '|'].forEach(delimiter => {
            const rows = parseDelimited(text, delimiter);
            try {
                const candidate = { ...detectRows(rows), delimiter };
                if (!best || candidate.score > best.score || (candidate.score === best.score && candidate.headers.length > best.headers.length)) best = candidate;
            } catch (_) {}
        });

        if (!best) throw new Error('No se reconoce una fila de cabeceras con fecha, concepto e importe.');
        return best;
    }

    function parseDate(value) {
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            const year = value.getFullYear();
            const month = value.getMonth() + 1;
            const day = value.getDate();
            return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
        const raw = String(value == null ? '' : value).trim().split(/[ T]/)[0];
        if (!raw) return null;
        let year;
        let month;
        let day;
        let match = raw.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
        if (match) {
            year = Number(match[1]); month = Number(match[2]); day = Number(match[3]);
        } else {
            match = raw.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/);
            if (match) {
                day = Number(match[1]); month = Number(match[2]); year = Number(match[3]);
                if (year < 100) year += year >= 70 ? 1900 : 2000;
            } else if (/^\d{5}(?:\.\d+)?$/.test(raw)) {
                const excelEpoch = Date.UTC(1899, 11, 30);
                const date = new Date(excelEpoch + Number(raw) * 86400000);
                year = date.getUTCFullYear(); month = date.getUTCMonth() + 1; day = date.getUTCDate();
            } else {
                return null;
            }
        }
        const test = new Date(Date.UTC(year, month - 1, day));
        if (test.getUTCFullYear() !== year || test.getUTCMonth() + 1 !== month || test.getUTCDate() !== day) return null;
        return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }

    function parseMoney(value) {
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        let raw = String(value == null ? '' : value).trim();
        if (!raw) return null;
        let negative = /^\(.*\)$/.test(raw) || /-$/.test(raw);
        raw = raw.replace(/[()]/g, '').replace(/-$/, '').replace(/[\s\u00A0€$£A-Za-z]/g, '');
        if (raw.startsWith('-')) negative = true;
        raw = raw.replace(/[^0-9,.-]/g, '').replace(/-/g, '');
        if (!raw) return null;

        const comma = raw.lastIndexOf(',');
        const dot = raw.lastIndexOf('.');
        if (comma >= 0 && dot >= 0) {
            const decimal = comma > dot ? ',' : '.';
            const thousands = decimal === ',' ? /\./g : /,/g;
            raw = raw.replace(thousands, '').replace(decimal, '.');
        } else if (comma >= 0) {
            const decimals = raw.length - comma - 1;
            raw = decimals === 1 || decimals === 2 ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
        } else if (dot >= 0) {
            const decimals = raw.length - dot - 1;
            raw = decimals === 1 || decimals === 2 ? raw.replace(/,/g, '') : raw.replace(/\./g, '');
        }

        const amount = Number(raw);
        if (!Number.isFinite(amount)) return null;
        return negative ? -amount : amount;
    }

    function categorize(description, signedAmount) {
        if (signedAmount > 0) return 'ingresos';
        const text = normalize(description);
        const has = words => words.some(word => text.includes(word));
        if (has(['alquiler', 'hipoteca', 'iberdrola', 'endesa', 'electricidad', 'luz', 'agua', 'gas ', 'internet', 'fibra', 'telefono', 'movil', 'seguro', 'netflix', 'spotify', 'gimnasio', 'cuota', 'recibo'])) return 'fijos';
        if (has(['mercadona', 'lidl', 'carrefour', 'aldi', 'dia ', 'supermercado', 'amazon', 'zara', 'tienda', 'compra'])) return 'compras';
        if (has(['restaurante', 'bar ', 'cafeteria', 'cafe', 'glovo', 'uber eats', 'just eat', 'mcdonald', 'burger king', 'comida', 'cena'])) return 'restaurantes';
        if (has(['repsol', 'cepsa', 'gasolinera', 'combustible', 'renfe', 'metro', 'autobus', 'taxi', 'uber', 'cabify', 'parking', 'peaje'])) return 'trabajo';
        return 'extra';
    }

    function cleanDescription(value) {
        return String(value == null ? '' : value).replace(/\s+/g, ' ').trim() || 'Movimiento bancario';
    }

    function fingerprintTransaction(transaction) {
        const cents = Math.round(Number(transaction.amount) * 100);
        return [transaction.date || '', normalize(transaction.desc), transaction.category === 'ingresos' ? 'in' : 'out', cents].join('|');
    }

    function buildRecords(structure, mapping) {
        const valid = [];
        const invalid = [];
        const indexes = Object.fromEntries(Object.entries(mapping).map(([key, value]) => [key, value === '' || value == null ? null : Number(value)]));
        const usesSignedAmount = indexes.amount != null;

        structure.rows.slice(structure.headerIndex + 1).forEach((row, offset) => {
            if (!row.some(cell => String(cell).trim())) return;
            const rowNumber = structure.headerIndex + offset + 2;
            const date = indexes.date == null ? null : parseDate(row[indexes.date]);
            const description = cleanDescription(indexes.description == null ? '' : row[indexes.description]);
            let signedAmount = null;

            if (usesSignedAmount) {
                signedAmount = parseMoney(row[indexes.amount]);
            } else {
                const debit = indexes.debit == null ? null : parseMoney(row[indexes.debit]);
                const credit = indexes.credit == null ? null : parseMoney(row[indexes.credit]);
                if (credit != null && credit !== 0) signedAmount = Math.abs(credit);
                else if (debit != null && debit !== 0) signedAmount = -Math.abs(debit);
            }

            if (!date || signedAmount == null || signedAmount === 0) {
                invalid.push({ rowNumber, reason: !date ? 'fecha no válida' : 'importe no válido' });
                return;
            }

            const record = {
                date,
                monthId: date.substring(0, 7),
                desc: description,
                category: categorize(description, signedAmount),
                amount: Math.abs(signedAmount),
                signedAmount,
                rowNumber
            };
            record.fingerprint = fingerprintTransaction(record);
            valid.push(record);
        });
        return { valid, invalid };
    }

    return { normalize, parseDelimited, detectRows, detectStructure, inferMapping, parseDate, parseMoney, categorize, buildRecords, fingerprintTransaction };
});
