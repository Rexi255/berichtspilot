// Auto-update: platform check, error texts, allowlist filter and the
// check → download → install flow — without Electron or electron-updater.
import { EventEmitter } from 'node:events'
import { describe, it, expect, vi } from 'vitest'
import { createUpdater, updateSupport, describeUpdateError, meansNoUpdate, stripHeaders, PARTITION } from './updater.js'

const codeError = (code, message = code) => Object.assign(new Error(message), { code })

function fakeUpdater({ check, download } = {}) {
  const u = new EventEmitter()
  u.checkForUpdates = vi.fn(check ?? (async () => ({ isUpdateAvailable: false, updateInfo: { version: '1.3.0' } })))
  u.downloadUpdate = vi.fn(download ?? (async () => []))
  u.quitAndInstall = vi.fn()
  return u
}

function setup({ updater = fakeUpdater(), isPackaged = true, platform = 'win32', env = {} } = {}) {
  let filter = null
  let headerFilter = null
  const ses = {
    webRequest: {
      onBeforeRequest: vi.fn((fn) => (filter = fn)),
      onBeforeSendHeaders: vi.fn((fn) => (headerFilter = fn)),
    },
  }
  const fromPartition = vi.fn(() => ses)
  const onChange = vi.fn()
  const loadUpdater = vi.fn(() => updater)
  const up = createUpdater({
    app: { isPackaged, getVersion: () => '1.2.0' },
    onChange,
    loadUpdater,
    getSession: () => ({ fromPartition }),
    platform,
    env,
    nsisInstalled: () => true,
  })
  const allowed = (url) => {
    let result
    filter({ url }, (r) => (result = r))
    return !result.cancel
  }
  const sentHeaders = (requestHeaders) => {
    let result
    headerFilter({ requestHeaders }, (r) => (result = r))
    return result.requestHeaders
  }
  return { up, updater, onChange, loadUpdater, fromPartition, allowed, sentHeaders }
}

describe('updateSupport', () => {
  it('allows the NSIS install and the AppImage only', () => {
    const nsisInstalled = () => true
    expect(updateSupport({ isPackaged: true, platform: 'win32', env: {}, nsisInstalled }).ok).toBe(true)
    expect(updateSupport({ isPackaged: true, platform: 'linux', env: { APPIMAGE: '/x/B.AppImage' } }).ok).toBe(true)
    expect(updateSupport({ isPackaged: false, platform: 'win32', env: {} }).ok).toBe(false)
    expect(updateSupport({ isPackaged: true, platform: 'win32', env: { PORTABLE_EXECUTABLE_DIR: 'D:\\' } }).ok).toBe(false)
    expect(updateSupport({ isPackaged: true, platform: 'linux', env: {} }).ok).toBe(false)
    expect(updateSupport({ isPackaged: true, platform: 'darwin', env: {} }).ok).toBe(false)
  })

  it('never updates an unpacked folder (no NSIS uninstaller next to the .exe)', () => {
    expect(updateSupport({ isPackaged: true, platform: 'win32', env: {}, nsisInstalled: () => false }).ok).toBe(false)
  })
})

describe('stripHeaders', () => {
  it('drops the per-install staging id, whatever its case', () => {
    expect(stripHeaders({ 'x-user-staging-id': 'uuid', 'X-User-Staging-Id': 'uuid', Accept: '*/*' })).toEqual({
      Accept: '*/*',
    })
    expect(stripHeaders(undefined)).toEqual({})
  })
})

describe('describeUpdateError', () => {
  it('maps network failures with the texts of net.js', () => {
    expect(describeUpdateError(new Error('net::ERR_INTERNET_DISCONNECTED')).code).toBe('offline')
    expect(describeUpdateError(new Error('net::ERR_TIMED_OUT')).code).toBe('timeout')
    expect(describeUpdateError(new Error('net::ERR_CERT_AUTHORITY_INVALID')).code).toBe('tls')
    expect(describeUpdateError(new Error('net::ERR_FAILED')).code).toBe('network')
  })

  it('reports a request stopped by the allowlist', () => {
    expect(describeUpdateError(new Error('net::ERR_BLOCKED_BY_CLIENT'))).toMatchObject({ code: 'blocked' })
  })

  it('maps HTTP errors from GitHub', () => {
    const http = (statusCode) => Object.assign(new Error('HttpError'), { statusCode })
    expect(describeUpdateError(http(403)).code).toBe('rate-limit')
    expect(describeUpdateError(http(429)).code).toBe('rate-limit')
    expect(describeUpdateError(http(502))).toMatchObject({ code: 'server', error: expect.stringContaining('502') })
    expect(describeUpdateError(http(400))).toMatchObject({ code: 'http', error: expect.stringContaining('400') })
  })

  it('flags broken downloads and falls back to a generic text', () => {
    expect(describeUpdateError(new Error('sha512 checksum mismatch, expected x, got y')).code).toBe('integrity')
    expect(describeUpdateError(codeError('ERR_UPDATER_INVALID_SIGNATURE')).code).toBe('integrity')
    expect(describeUpdateError(new Error('spawn EACCES'))).toEqual({
      code: 'update',
      error: 'Das Update ist fehlgeschlagen. Bitte später erneut versuchen.',
    })
    expect(describeUpdateError(undefined).code).toBe('update')
  })
})

describe('meansNoUpdate', () => {
  it('treats a release without update metadata as "no update"', () => {
    expect(meansNoUpdate(codeError('ERR_UPDATER_CHANNEL_FILE_NOT_FOUND', 'Cannot find latest.yml'))).toBe(true)
    expect(meansNoUpdate(codeError('ERR_UPDATER_NO_PUBLISHED_VERSIONS'))).toBe(true)
  })

  it('treats a missing production release (wrapped 404 of /releases/latest) as "no update"', () => {
    const wrapped = (inner) =>
      codeError(
        'ERR_UPDATER_INVALID_RELEASE_FEED',
        `Cannot parse releases feed: Error: Unable to find latest version on GitHub (https://github.com/x/y/releases/latest), please ensure a production release exists: ${inner}`
      )
    expect(meansNoUpdate(wrapped('HttpError: 404 Not Found\nHeaders: {}'))).toBe(true)
    expect(meansNoUpdate(wrapped('HttpError: 500 Internal Server Error'))).toBe(false)
    expect(meansNoUpdate(codeError('ERR_UPDATER_INVALID_RELEASE_FEED', 'Cannot parse releases feed: bad XML'))).toBe(false)
  })

  it('keeps wrapped network errors and other codes as errors', () => {
    const offline = codeError('ERR_UPDATER_CHANNEL_FILE_NOT_FOUND', 'Cannot find latest.yml: net::ERR_INTERNET_DISCONNECTED')
    expect(meansNoUpdate(offline)).toBe(false)
    expect(meansNoUpdate(codeError('ERR_UPDATER_INVALID_UPDATE_INFO'))).toBe(false)
    expect(meansNoUpdate(new Error('x'))).toBe(false)
  })
})

describe('createUpdater', () => {
  it('never loads electron-updater when the app cannot update itself', async () => {
    const { up, loadUpdater, fromPartition } = setup({ isPackaged: false })
    expect(up.status()).toMatchObject({ ok: true, state: 'unsupported', current: '1.2.0' })
    expect((await up.check()).state).toBe('unsupported')
    expect((await up.download()).state).toBe('unsupported')
    expect(up.install().ok).toBe(false)
    expect(loadUpdater).not.toHaveBeenCalled()
    expect(fromPartition).not.toHaveBeenCalled()
  })

  it('locks the updater session to the update hosts before the first request', async () => {
    const { up, updater, fromPartition, allowed } = setup()
    await up.check()
    expect(fromPartition).toHaveBeenCalledWith(PARTITION, { cache: false })
    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(false)
    expect(allowed('https://github.com/Rexi255/berichtspilot/releases.atom')).toBe(true)
    expect(allowed('https://release-assets.githubusercontent.com/a/b')).toBe(true)
    expect(allowed('https://api.github.com/repos/Rexi255/berichtspilot')).toBe(false)
    expect(allowed('http://github.com/Rexi255/berichtspilot/releases.atom')).toBe(false)
    expect(allowed('https://evil.example/latest.yml')).toBe(false)
  })

  it('never sends the per-install staging id', async () => {
    const { up, sentHeaders } = setup()
    await up.check()
    expect(sentHeaders({ 'x-user-staging-id': 'uuid', accept: '*/*' })).toEqual({ accept: '*/*' })
  })

  it('reports "none" when the current version is the newest', async () => {
    const { up, onChange } = setup()
    expect(await up.check()).toEqual({ ok: true, state: 'none', current: '1.2.0' })
    expect(onChange.mock.calls.map(([s]) => s.state)).toEqual(['checking', 'none'])
  })

  it('reports "none" for a newest release without latest.yml (v1.2.0)', async () => {
    const updater = fakeUpdater({
      check: async () => {
        updater.emit('error', new Error('emitted too'))
        throw codeError('ERR_UPDATER_CHANNEL_FILE_NOT_FOUND', 'Cannot find latest.yml in the latest release artifacts')
      },
    })
    const { up } = setup({ updater })
    expect((await up.check()).state).toBe('none')
  })

  it('goes check → available → download with progress → ready → install, each only when called', async () => {
    let finishDownload
    const updater = fakeUpdater({
      check: async () => ({ isUpdateAvailable: true, updateInfo: { version: '1.3.0' } }),
      download: () => new Promise((resolve) => (finishDownload = resolve)),
    })
    const { up, onChange } = setup({ updater })

    expect(await up.check()).toEqual({ ok: true, state: 'available', current: '1.2.0', version: '1.3.0' })
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
    expect(up.install()).toMatchObject({ ok: false })

    const downloading = up.download()
    expect(up.status()).toMatchObject({ state: 'downloading', version: '1.3.0', percent: 0 })
    updater.emit('download-progress', { percent: 41.7 })
    updater.emit('download-progress', { percent: 41.9 }) // same whole percent → no extra event
    expect(up.status().percent).toBe(41)
    expect((await up.check()).state).toBe('downloading') // no re-check mid-download
    finishDownload([])
    expect(await downloading).toMatchObject({ state: 'ready', version: '1.3.0' })
    expect(updater.quitAndInstall).not.toHaveBeenCalled()

    expect(up.install()).toEqual({ ok: true })
    expect(updater.quitAndInstall).toHaveBeenCalledWith(true, true)
    expect(onChange.mock.calls.map(([s]) => s.state)).toEqual(['checking', 'available', 'downloading', 'downloading', 'ready'])
  })

  it('reports an install that electron-updater refused (only via its error event)', async () => {
    const updater = fakeUpdater({ check: async () => ({ isUpdateAvailable: true, updateInfo: { version: '1.3.0' } }) })
    updater.quitAndInstall = vi.fn(() => updater.emit('error', new Error("No update filepath provided, can't quit and install")))
    const { up } = setup({ updater })
    await up.check()
    await up.download()
    expect(up.install()).toMatchObject({ ok: false, error: expect.any(String) })
    expect(up.status()).toMatchObject({ ok: false, state: 'error', version: '1.3.0', code: 'update' })
    expect(updater.listenerCount('error')).toBe(1) // the temporary listener is gone again
  })

  it('calls quitAndInstall only once, even on a second click', async () => {
    const updater = fakeUpdater({ check: async () => ({ isUpdateAvailable: true, updateInfo: { version: '1.3.0' } }) })
    const { up } = setup({ updater })
    await up.check()
    await up.download()
    expect(up.install()).toEqual({ ok: true })
    expect(up.install()).toEqual({ ok: true })
    expect(updater.quitAndInstall).toHaveBeenCalledOnce()
  })

  it('does not download without a found update', async () => {
    const { up, updater } = setup()
    await up.download()
    await up.check() // → none
    await up.download()
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
  })

  it('shares one request between concurrent checks', async () => {
    const { up, updater } = setup()
    const [a, b] = await Promise.all([up.check(), up.check()])
    expect(a).toBe(b)
    expect(updater.checkForUpdates).toHaveBeenCalledOnce()
    await up.check()
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2)
  })

  it('turns failures into an error status and allows a retry', async () => {
    let fail = true
    const updater = fakeUpdater({
      check: async () => ({ isUpdateAvailable: true, updateInfo: { version: '1.3.0' } }),
      download: async () => {
        if (fail) throw new Error('net::ERR_CONNECTION_RESET')
        return []
      },
    })
    const { up } = setup({ updater })
    await up.check()
    expect(await up.download()).toMatchObject({ ok: false, state: 'error', code: 'offline', version: '1.3.0' })
    fail = false
    expect((await up.download()).state).toBe('ready')
  })

  it('reports a failed check', async () => {
    const updater = fakeUpdater({ check: async () => Promise.reject(new Error('net::ERR_NAME_NOT_RESOLVED')) })
    const { up } = setup({ updater })
    expect(await up.check()).toMatchObject({ ok: false, state: 'error', code: 'offline', current: '1.2.0' })
    expect((await up.download()).state).toBe('error') // nothing found → nothing to download
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
  })
})
