import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { login, register as registerUser, setToken, recoverPassword, getRememberedUser, setRememberedUser, clearRememberedUser } from '../services/auth';
import { Eye, EyeOff, KeyRound, MessageSquare, UserPlus, Fingerprint } from 'lucide-react';
import axios from 'axios';

function RadarBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let angle = 0;
    let animationId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const maxR = Math.min(cx, cy) * 0.9;

      ctx.save();
      ctx.translate(cx, cy);

      for (let i = 1; i <= 5; i++) {
        const r = (maxR / 5) * i;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(59, 130, 246, ${0.06 + i * 0.01})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      for (let i = 0; i < 12; i++) {
        const a = (Math.PI * 2 * i) / 12;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * maxR * 0.1, Math.sin(a) * maxR * 0.1);
        ctx.lineTo(Math.cos(a) * maxR, Math.sin(a) * maxR);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.04)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      const sweep = ctx.createConicGradient(angle, 0, 0);
      sweep.addColorStop(0, 'rgba(59, 130, 246, 0.12)');
      sweep.addColorStop(0.02, 'rgba(34, 211, 238, 0.08)');
      sweep.addColorStop(0.08, 'rgba(59, 130, 246, 0.02)');
      sweep.addColorStop(1, 'transparent');
      ctx.fillStyle = sweep;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, maxR, angle - 0.4, angle);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * maxR, Math.sin(angle) * maxR);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();

      angle += 0.008;
      if (angle > Math.PI * 2) angle -= Math.PI * 2;

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} />
  );
}

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState(getRememberedUser());
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(!!getRememberedUser());
  const [showRecover, setShowRecover] = useState(false);
  const [recoverUsername, setRecoverUsername] = useState('');
  const [recoverSent, setRecoverSent] = useState(false);
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirm, setRegisterConfirm] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioAvailable, setBioAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    axios.get('/api/biometria/status').then(r => setBioAvailable(r.data.registered)).catch(() => setBioAvailable(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(username, password);
      setToken(data.token);
      localStorage.setItem('radar_fx_user', data.username);
      if (rememberMe) {
        setRememberedUser(username);
      } else {
        clearRememberedUser();
      }
      onLogin();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRecoverLoading(true);
    try {
      await recoverPassword(recoverUsername || username);
      setRecoverSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRecoverLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (registerPassword !== registerConfirm) {
      setError('As senhas não coincidem');
      return;
    }
    setRegisterLoading(true);
    try {
      const data = await registerUser(registerUsername, registerPassword);
      setToken(data.token);
      localStorage.setItem('radar_fx_user', data.username);
      onLogin();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setError('');
    setBioLoading(true);
    const userId = localStorage.getItem('radar_fx_bio_user') || 'radar-fx-user-001';
    try {
      const { data: raw } = await axios.post('/api/biometria/login/begin', { userId });

      const publicKey: PublicKeyCredentialRequestOptions = {
        ...raw,
        challenge: base64UrlToUint8Array(raw.challenge),
        allowCredentials: (raw.allowCredentials || []).map((c: any) => ({
          ...c,
          id: base64UrlToUint8Array(c.id),
        })),
      };

      const assertion = await navigator.credentials.get({ publicKey });

      const cred = assertion as PublicKeyCredential;
      const response = cred.response as AuthenticatorAssertionResponse;

      const credentialData = {
        id: cred.id,
        rawId: uint8ArrayToBase64Url(new Uint8Array(cred.rawId)),
        type: cred.type,
        response: {
          clientDataJSON: uint8ArrayToBase64Url(new Uint8Array(response.clientDataJSON)),
          authenticatorData: uint8ArrayToBase64Url(new Uint8Array(response.authenticatorData)),
          signature: uint8ArrayToBase64Url(new Uint8Array(response.signature)),
          userHandle: response.userHandle ? uint8ArrayToBase64Url(new Uint8Array(response.userHandle)) : null,
        },
      };

      const { data: loginData } = await axios.post('/api/biometria/login/complete', { credential: credentialData, userId });
      setToken(loginData.token);
      localStorage.setItem('radar_fx_user', loginData.username);
      onLogin();
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Autenticação cancelada pelo usuário');
      } else {
        setError(err?.response?.data?.error || err.message || 'Falha na autenticação biométrica');
      }
    } finally {
      setBioLoading(false);
    }
  };

  function base64UrlToUint8Array(base64Url: string): Uint8Array {
    const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i);
    return array;
  }

  function uint8ArrayToBase64Url(array: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < array.length; i++) binary += String.fromCharCode(array[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  if (showRecover) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        <RadarBackground />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.12)_0%,_transparent_70%)] pointer-events-none" style={{ zIndex: 1 }} />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm" style={{ zIndex: 2 }}>
          <form onSubmit={handleRecover} className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-800 p-8 shadow-2xl">
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                <KeyRound size={24} className="text-blue-400" />
              </div>
              <h1 className="text-[22px] font-black">
                <span className="bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">RADAR</span>{' '}
                <span className="text-white">FX</span>
              </h1>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1">Recuperar Senha</p>
            </div>

            {recoverSent ? (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                <div className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs px-3 py-3 rounded-xl mb-6">
                  <MessageSquare size={16} className="inline mr-1.5 -mt-0.5" />
                  Instruções de recuperação enviadas. Entre em contato com o suporte para redefinir sua senha.
                </div>
                <button type="button" onClick={() => { setShowRecover(false); setRecoverSent(false); }} className="text-blue-400 hover:text-blue-300 text-xs font-semibold transition">
                  Voltar ao login
                </button>
              </motion.div>
            ) : (
              <>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-xl mb-4">
                    {error}
                  </motion.div>
                )}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1.5 block">Usuário</label>
                  <input type="text" placeholder="Digite seu usuário" value={recoverUsername || username} onChange={e => setRecoverUsername(e.target.value)}
                    className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:shadow-[0_0_12px_rgba(59,130,246,0.15)] transition" />
                </div>
                <button type="submit" disabled={recoverLoading || !(recoverUsername || username)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-xl mt-6 transition-all disabled:opacity-40 shadow-lg shadow-blue-600/20">
                  {recoverLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enviando...
                    </span>
                  ) : 'Enviar instruções'}
                </button>
                <button type="button" onClick={() => { setShowRecover(false); setError(''); }} className="w-full text-center text-slate-500 hover:text-slate-300 text-xs font-semibold mt-3 transition">
                  Voltar ao login
                </button>
              </>
            )}
            <div className="mt-6 pt-4 border-t border-slate-800">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600 text-center">Sistema de Trading Automatizado</p>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  if (showRegister) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        <RadarBackground />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.12)_0%,_transparent_70%)] pointer-events-none" style={{ zIndex: 1 }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(34,211,238,0.04)_0%,_transparent_50%)] pointer-events-none" style={{ zIndex: 1 }} />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm" style={{ zIndex: 2 }}>
          <form onSubmit={handleRegister} className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-800 p-8 shadow-2xl">
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                <UserPlus size={24} className="text-blue-400" />
              </div>
              <h1 className="text-[22px] font-black">
                <span className="bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">RADAR</span>{' '}
                <span className="text-white">FX</span>
              </h1>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1">Criar Conta</p>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-xl mb-4">
                {error}
              </motion.div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1.5 block">Usuário</label>
                <input type="text" placeholder="Mínimo 3 caracteres" value={registerUsername} onChange={e => setRegisterUsername(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:shadow-[0_0_12px_rgba(59,130,246,0.15)] transition" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1.5 block">Senha</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" value={registerPassword} onChange={e => setRegisterPassword(e.target.value)}
                    className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:shadow-[0_0_12px_rgba(59,130,246,0.15)] transition" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1.5 block">Confirmar Senha</label>
                <input type="password" placeholder="Repita a senha" value={registerConfirm} onChange={e => setRegisterConfirm(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:shadow-[0_0_12px_rgba(59,130,246,0.15)] transition" />
              </div>
            </div>

            <button type="submit" disabled={registerLoading || !registerUsername || !registerPassword || !registerConfirm}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-xl mt-6 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30">
              {registerLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Criando conta...
                </span>
              ) : 'Criar Conta'}
            </button>

            <button type="button" onClick={() => { setShowRegister(false); setError(''); setRegisterUsername(''); setRegisterPassword(''); setRegisterConfirm(''); }}
              className="w-full text-center text-slate-500 hover:text-slate-300 text-xs font-semibold mt-3 transition">
              Já tenho conta. Entrar
            </button>

            <div className="mt-6 pt-4 border-t border-slate-800">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600 text-center">Sistema de Trading Automatizado</p>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <RadarBackground />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.12)_0%,_transparent_70%)] pointer-events-none" style={{ zIndex: 1 }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(34,211,238,0.04)_0%,_transparent_50%)] pointer-events-none" style={{ zIndex: 1 }} />

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="w-full max-w-sm" style={{ zIndex: 2 }}>
        <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-800 p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 rounded-full border border-blue-500/30 animate-ping" style={{ animationDuration: '2.5s' }} />
              <div className="absolute inset-2 rounded-full border border-cyan-400/30 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.4s' }} />
              <div className="absolute inset-4 rounded-full border border-blue-400/30 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.8s' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-white shadow-[0_0_20px_rgba(96,165,250,1)]" />
              </div>
            </div>
            <h1 className="text-[22px] font-black">
              <span className="bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">RADAR</span>{' '}
              <span className="text-white">FX</span>
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1">Acesso Restrito</p>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-xl mb-4">
              {error}
            </motion.div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1.5 block">Usuário</label>
              <input type="text" placeholder="Digite seu usuário" value={username} onChange={e => setUsername(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:shadow-[0_0_12px_rgba(59,130,246,0.15)] transition" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1.5 block">Senha</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} placeholder="Digite sua senha" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:shadow-[0_0_12px_rgba(59,130,246,0.15)] transition" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div onClick={() => setRememberMe(!rememberMe)}
                className={`w-4 h-4 rounded border transition flex items-center justify-center ${rememberMe ? 'bg-blue-600 border-blue-600' : 'border-slate-600 group-hover:border-slate-500'}`}>
                {rememberMe && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span className="text-[11px] text-slate-400 group-hover:text-slate-300 transition">Lembrar de mim</span>
            </label>
            <button type="button" onClick={() => { setShowRecover(true); setError(''); }} className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold transition">
              Recuperar senha
            </button>
          </div>

          <button type="submit" disabled={loading || !username || !password}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-xl mt-5 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Entrando...
              </span>
            ) : 'Entrar'}
          </button>

          {bioAvailable !== null && (
            <div className="mt-4">
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800" /></div>
                <div className="relative flex justify-center"><span className="bg-slate-800/50 px-3 text-[9px] uppercase tracking-widest text-slate-600">ou</span></div>
              </div>
              {bioAvailable ? (
                <button type="button" onClick={handleBiometricLogin} disabled={bioLoading}
                  className="w-full bg-slate-700/50 hover:bg-slate-700/80 text-slate-300 text-sm font-semibold py-2.5 rounded-xl transition-all disabled:opacity-40 border border-slate-700/50 flex items-center justify-center gap-2">
                  {bioLoading ? (
                    <span className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin" />
                  ) : <Fingerprint size={18} />}
                  {bioLoading ? 'Autenticando...' : 'Login Biométrico'}
                </button>
              ) : (
                <button type="button" onClick={() => { setShowRegister(true); setError(''); }}
                  className="w-full bg-slate-800/50 hover:bg-slate-700/50 text-slate-500 text-sm font-semibold py-2.5 rounded-xl transition-all border border-slate-700/30 flex items-center justify-center gap-2 cursor-pointer">
                  <Fingerprint size={18} />
                  Cadastre sua biometria na Central de Segurança
                </button>
              )}
            </div>
          )}

          <div className="mt-4 text-center">
            <button type="button" onClick={() => { setShowRegister(true); setError(''); setRegisterUsername(''); setRegisterPassword(''); setRegisterConfirm(''); }}
              className="text-[11px] text-slate-400 hover:text-white font-semibold transition">
              Não tem conta? <span className="text-blue-400 hover:text-blue-300">Registrar-se</span>
            </button>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600 text-center">Sistema de Trading Automatizado</p>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
