/*
@jnode/server-log

Official logger for JNS.

by JustApple & Google Gemini
*/

// dependencies
const fs = require('fs');
const path = require('path');

// default item registery
const defaultItemRegistery = {
    // [12/31/2023, 14:30:05] (Local)
    local: (time, env, ctx, plain, styled) => {
        const val = time.toLocaleString();
        plain.push(`[${val}]`);
        styled.push(`\x1b[90m[${val}]\x1b[0m`);
    },

    // [14:30:05] (Local)
    localTime: (time, env, ctx, plain, styled) => {
        const val = time.toLocaleTimeString();
        plain.push(`[${val}]`);
        styled.push(`\x1b[90m[${val}]\x1b[0m`);
    },

    // [12/31/2023] (Local)
    localDate: (time, env, ctx, plain, styled) => {
        const val = time.toLocaleDateString();
        plain.push(`[${val}]`);
        styled.push(`\x1b[90m[${val}]\x1b[0m`);
    },

    // [2023-12-31T14:30:05.000Z] (UTC)
    iso: (time, env, ctx, plain, styled) => {
        const val = time.toISOString();
        plain.push(`[${val}]`);
        styled.push(`\x1b[90m[${val}]\x1b[0m`);
    },

    // [14:30:05.000Z] (UTC)
    isoTime: (time, env, ctx, plain, styled) => {
        const val = time.toISOString().split('T')[1];
        plain.push(`[${val}]`);
        styled.push(`\x1b[90m[${val}]\x1b[0m`);
    },

    // [2023-12-31] (UTC)
    isoDate: (time, env, ctx, plain, styled) => {
        const val = time.toISOString().split('T')[0];
        plain.push(`[${val}]`);
        styled.push(`\x1b[90m[${val}]\x1b[0m`);
    },

    // [1704024000000]
    timestamp: (time, env, ctx, plain, styled) => {
        const val = time.getTime();
        plain.push(`[${val}]`);
        styled.push(`\x1b[90m[${val}]\x1b[0m`);
    },

    // 5ms (Dynamic Color)
    responseTime: (time, env, ctx, plain, styled) => {
        const ms = Date.now() - time.getTime();
        const val = `${ms}ms`;
        plain.push(val);

        let color = 32; // Green < 100ms
        if (ms >= 500) color = 31;      // Red >= 500ms
        else if (ms >= 100) color = 33; // Yellow >= 100ms

        styled.push(`\x1b[${color}m${val}\x1b[0m`);
    },

    // GET, POST, etc. (Purple)
    method: (time, env, ctx, plain, styled) => {
        const method = ctx.method || 'GET';
        plain.push(method);
        styled.push(`\x1b[94m${method}\x1b[0m`);
    },

    // ---, 200, 404, 500
    statusCode: (time, env, ctx, plain, styled) => {
        const status = ctx.res?.statusCode || 0;

        if (!status) {
            plain.push('---');
            styled.push('\x1b[37m---\x1b[0m'); // White
            return;
        }

        plain.push(status);

        let color = 32; // 2xx Green
        if (status >= 500) color = 31;      // 5xx Red
        else if (status >= 400) color = 33; // 4xx Yellow
        else if (status >= 300) color = 36; // 3xx Cyan

        styled.push(`\x1b[${color}m${status}\x1b[0m`);
    },

    // /path/to/resource (White)
    path: (time, env, ctx, plain, styled) => {
        plain.push(ctx.path);
        styled.push(`\x1b[37m${ctx.path}\x1b[0m`);
    },

    // example.com/path?query=1 (White)
    url: (time, env, ctx, plain, styled) => {
        const val = (ctx.host || '') + (ctx.req?.url || '');
        plain.push(val);
        styled.push(`\x1b[37m${val}\x1b[0m`);
    },

    // example.com (White)
    host: (time, env, ctx, plain, styled) => {
        plain.push(ctx.host);
        styled.push(`\x1b[37m${ctx.host}\x1b[0m`);
    },

    // 127.0.0.1 (Gray)
    ip: (time, env, ctx, plain, styled) => {
        const addr = ctx.identity?.address || '-';
        plain.push(addr);
        styled.push(`\x1b[90m${addr}\x1b[0m`);
    },

    // User-Agent string (Gray)
    ua: (time, env, ctx, plain, styled) => {
        const ua = ctx.headers?.['user-agent'] || '-';
        plain.push(`"${ua}"`);
        styled.push(`\x1b[90m"${ua}"\x1b[0m`);
    },

    // Referer header (Gray)
    referer: (time, env, ctx, plain, styled) => {
        const ref = ctx.headers?.['referer'] || '-';
        plain.push(ref);
        styled.push(`\x1b[90m${ref}\x1b[0m`);
    },

    // router depth (Cyan)
    depth: (time, env, ctx, plain, styled) => {
        plain.push(env.i);
        styled.push(`\x1b[36m@${env.i}\x1b[0m`);
    }
};

// log router
class LogRouter {
    constructor(next, options) {
        this.options = options;
        this.next = next;

        this._itemRegistery = this.options.itemRegistery ?? defaultItemRegistery;

        this._consoleItems = (
            this.options.consoleItems ?? this.options.fileItems ?? [
                'localTime',
                'statusCode',
                'method',
                'url',
                'ip',
                'responseTime'
            ]
        ).map((i) => {
            if (this._itemRegistery[i]) return this._itemRegistery[i];
            else if (defaultItemRegistery[i]) return defaultItemRegistery[i];
            else if (typeof i === 'function') return i;
            else return (time, env, ctx, plain, styled) => { plain.push('?'); styled.push('\x1b[90m?\x1b[0m') };
        });

        this._fileItems = (
            this.options.fileItems ?? this.options.consoleItems ?? [
                'iso',
                'statusCode',
                'method',
                'url',
                'ip',
                'ua',
                'responseTime'
            ]
        ).map((i) => {
            if (this._itemRegistery[i]) return this._itemRegistery[i];
            else if (defaultItemRegistery[i]) return defaultItemRegistery[i];
            else if (typeof i === 'function') return i;
            else return (time, env, ctx, plain, styled) => { plain.push('?'); styled.push('\x1b[90m?\x1b[0m') };
        });
    }

    route(env, ctx) {
        const startTime = new Date();
        let isFinished = false;

        const finalize = () => {
            if (isFinished) return;
            isFinished = true;

            if (timer) clearTimeout(timer);

            ctx.res.removeListener('finish', finalize);
            ctx.res.removeListener('close', finalize);
            ctx.res.removeListener('error', finalize);

            this.log(startTime, env, ctx);
        };

        const forceLogMs = this.options.forceLog ?? 10000;
        const timer = setTimeout(finalize, forceLogMs);

        ctx.res.once('finish', finalize);
        ctx.res.once('close', finalize);
        ctx.res.once('error', finalize);

        // make other routers/handlers could control the log time, like WSHandler
        ctx.finalizeLog = finalize;

        return this.next;
    }

    async log(time = new Date(), env, ctx) {
        const iso = time.toISOString();
        const date = iso.slice(0, 10);

        // if folder is specific
        if (this.options.folder && this._date !== date) {
            this._date = date;
            this._fileStream?.end();
            this._fileStream = fs.createWriteStream(path.join(this.options.folder, date + '.log'), { flags: 'a' });
        }

        if (!this.options.disableConsoleLog) {
            let plainLog = [];
            let styledLog = [];

            for (let i of this._consoleItems) {
                i(time, env, ctx, plainLog, styledLog);
            }

            console.log(this.options.plainConsoleLog ? plainLog.join(this.options.sep ?? ' ') : styledLog.join(' '));
        }

        if (this._fileHandle) {
            let plainLog = [];
            let styledLog = [];

            for (let i of this._fileItems) {
                i(time, env, ctx, plainLog, styledLog);
            }

            this._fileStream.write(plainLog.join(this.options.sep ?? ' ') + '\n');
        }
    }
}

// export
module.exports = {
    LogRouter,
    routerConstructors: {
        Log: (next, options) => new LogRouter(next, options),
    }
};