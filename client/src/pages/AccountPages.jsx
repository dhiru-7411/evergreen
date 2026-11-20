import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { Loading } from '../components/Status';
import { formatDate, timeAgo } from '../utils/format';

const Alert = ({ kind = 'error', children }) => (
  <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
    {children}
  </div>
);

// Opened from the link in the verification email.
export const VerifyEmail = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { setUser } = useAuth();
  const [state, setState] = useState({
    status: token ? 'working' : 'error',
    message: 'This link is missing its token.',
  });
  const sent = useRef(false);

  useEffect(() => {
    // Tokens are single-use, so make sure React's dev double-effect can't spend it twice.
    if (!token || sent.current) return;
    sent.current = true;
    api
      .post('/auth/verify-email', { token })
      .then((res) => {
        setState({ status: 'ok', message: res.data.message });
        api
          .get('/auth/me')
          .then((r) => setUser(r.data.user))
          .catch(() => {});
      })
      .catch((err) => setState({ status: 'error', message: errorMessage(err) }));
  }, [token, setUser]);

  return (
    <div className="card auth-card">
      <h1 style={{ fontSize: '1.6rem' }}>Confirm your email</h1>
      {state.status === 'working' && <Loading label="Confirming…" />}
      {state.status === 'ok' && (
        <>
          <Alert kind="ok">{state.message}</Alert>
          <p>
            <Link to="/learn">Start exploring topics →</Link>
          </p>
        </>
      )}
      {state.status === 'error' && (
        <>
          <Alert>{state.message}</Alert>
          <p className="faint">
            <Link to="/account">Go to your account</Link> to send a new link.
          </p>
        </>
      )}
    </div>
  );
};

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(res.data.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card auth-card">
      <h1 style={{ fontSize: '1.6rem' }}>Reset your password</h1>
      {message ? (
        <Alert kind="ok">{message}</Alert>
      ) : (
        <form onSubmit={submit}>
          {error && <Alert>{error}</Alert>}
          <p className="faint" style={{ margin: 0 }}>
            Enter the email you signed up with and we'll send you a link to choose a new password.
          </p>
          <label className="field">
            <span>Email</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
      <p className="faint" style={{ marginTop: 14 }}>
        <Link to="/login">Back to log in</Link>
      </p>
    </div>
  );
};

export const ResetPassword = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError("The passwords don't match");
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setUser(null);
      navigate('/login', { replace: true, state: { notice: 'Password updated. Sign in with your new password.' } });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="card auth-card">
      <h1 style={{ fontSize: '1.6rem' }}>Choose a new password</h1>
      <form onSubmit={submit}>
        {!token && <Alert>This link is missing its token. Request a new one.</Alert>}
        {error && <Alert>{error}</Alert>}
        <label className="field">
          <span>New password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <span className="hint">At least 8 characters. All your devices will be signed out.</span>
        </label>
        <label className="field">
          <span>Confirm new password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy || !token}>
          {busy ? 'Saving…' : 'Set new password'}
        </button>
      </form>
      <p className="faint" style={{ marginTop: 14 }}>
        <Link to="/forgot-password">Request a new link</Link>
      </p>
    </div>
  );
};

const describeDevice = (ua = '') => {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return ua ? `${browser}${os ? ` on ${os}` : ''}` : 'Unknown device';
};

const EmailStatus = ({ user }) => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (user.emailVerified) return <p>✓ {user.email} is confirmed.</p>;
  const resend = async () => {
    setError('');
    try {
      const res = await api.post('/auth/resend-verification');
      setMessage(res.data.message);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <>
      <p>
        {user.email} isn't confirmed yet.
        {user.verificationRequired && ' Confirm it to post, suggest resources, request topics and vote.'}
      </p>
      {message ? <Alert kind="ok">{message}</Alert> : null}
      {error && <Alert>{error}</Alert>}
      {!message && (
        <div>
          <button className="btn btn-sm" onClick={resend}>
            Send a new confirmation link
          </button>
        </div>
      )}
    </>
  );
};

const ChangePassword = () => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const res = await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      setMessage(res.data.message);
      setCurrent('');
      setNext('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="account-form" onSubmit={submit}>
      {message && <Alert kind="ok">{message}</Alert>}
      {error && <Alert>{error}</Alert>}
      <label className="field">
        <span>Current password</span>
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </label>
      <label className="field">
        <span>New password</span>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
        <span className="hint">At least 8 characters. Your other devices will be signed out.</span>
      </label>
      <div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </div>
    </form>
  );
};

const Devices = () => {
  const [refresh, setRefresh] = useState(0);
  const { data: devices, error: loadError } = useFetch('/auth/sessions', refresh);
  const [error, setError] = useState('');

  const signOut = async (id, current) => {
    setError('');
    try {
      await api.delete(`/auth/sessions/${id}`);
      if (current) return window.location.assign('/login');
      setRefresh((n) => n + 1);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const everywhere = async () => {
    setError('');
    try {
      await api.post('/auth/logout-all');
      window.location.assign('/login');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!devices) return loadError ? <Alert>{loadError}</Alert> : <Loading />;
  return (
    <>
      {error && <Alert>{error}</Alert>}
      <ul className="device-list">
        {devices.map((d) => (
          <li key={d._id} className="spread">
            <span>
              <b>{describeDevice(d.userAgent)}</b>
              {d.current && <span className="badge s-fresh">This device</span>}
              <br />
              <span className="faint">
                Signed in {formatDate(d.createdAt)} · last active {timeAgo(d.lastUsedAt)}
              </span>
            </span>
            <button className="btn btn-sm btn-ghost" onClick={() => signOut(d._id, d.current)}>
              Sign out
            </button>
          </li>
        ))}
      </ul>
      <button className="btn btn-sm btn-danger" onClick={everywhere}>
        Log out everywhere
      </button>
    </>
  );
};

export const Account = () => {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <h1>Account</h1>
      <p className="faint">
        Signed in as <b>@{user.username}</b>
        {user.role === 'admin' && ' · admin'}
      </p>

      <section className="card account-section">
        <h2 className="section-title">Email</h2>
        <EmailStatus user={user} />
      </section>

      <section className="card account-section">
        <h2 className="section-title">Password</h2>
        <ChangePassword />
      </section>

      <section className="card account-section">
        <h2 className="section-title">Signed-in devices</h2>
        <p className="faint">If you see a device you don't recognise, sign it out and change your password.</p>
        <Devices />
      </section>
    </div>
  );
};

// Shown across the site while an email still needs confirming (only when required).
export const VerifyBanner = () => {
  const { user } = useAuth();
  if (!user || user.emailVerified || !user.verificationRequired) return null;
  return (
    <div className="verify-banner">
      <div className="container">
        Confirm your email to start contributing. Check your inbox for the link, or{' '}
        <Link to="/account">send a new one</Link>.
      </div>
    </div>
  );
};
