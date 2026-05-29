import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Fingerprint, Shield, CheckCircle2, XCircle, RefreshCw, Smartphone } from 'lucide-react';
import axios from 'axios';

type BiometricStatus = 'unregistered' | 'registering' | 'registered' | 'error';

export default function BiometricRegistration() {
    const [status, setStatus] = useState<BiometricStatus>('unregistered');
    const [credentialCount, setCredentialCount] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const checkStatus = async () => {
        try {
            const resp = await axios.get('/api/biometria/status');
            setStatus(resp.data.registered ? 'registered' : 'unregistered');
            setCredentialCount(resp.data.credentialCount || 0);
        } catch {
            setStatus('unregistered');
        }
    };

    useEffect(() => {
        checkStatus();
        if (window.PublicKeyCredential) {
            PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(avail => {
                console.log('[Biometria] Platform authenticator available:', avail);
            }).catch(() => {
                console.log('[Biometria] Could not check platform authenticator');
            });
        } else {
            console.log('[Biometria] WebAuthn (PublicKeyCredential) not supported');
        }
    }, []);

    const handleRegister = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const beginResp = await axios.post('/api/biometria/register/begin', {
                userName: 'trader@radarfx.com',
                userId: 'radar-fx-user-001',
            });

            const options: any = {
                ...beginResp.data,
                challenge: base64UrlToUint8Array(beginResp.data.challenge),
                user: {
                    ...beginResp.data.user,
                    id: base64UrlToUint8Array(beginResp.data.user.id),
                },
            };
            if (options.excludeCredentials) {
                options.excludeCredentials = options.excludeCredentials.map((c: any) => ({
                    ...c,
                    id: base64UrlToUint8Array(c.id),
                }));
            }

            const credential = await navigator.credentials.create({ publicKey: options });

            if (!credential) {
                throw new Error('User cancelled or no credential returned');
            }

            const cred = credential as PublicKeyCredential;
            const response = cred.response as AuthenticatorAttestationResponse;

            const credentialData = {
                id: cred.id,
                rawId: uint8ArrayToBase64Url(new Uint8Array(cred.rawId)),
                type: cred.type,
                response: {
                    clientDataJSON: uint8ArrayToBase64Url(new Uint8Array(response.clientDataJSON)),
                    attestationObject: uint8ArrayToBase64Url(new Uint8Array(response.attestationObject)),
                    transports: response.getTransports?.() || [],
                },
            };

            const userId = 'radar-fx-user-001';
            const completeResp = await axios.post('/api/biometria/register/complete', {
                credential: credentialData,
                userId,
            });

            if (completeResp.data.verified) {
                localStorage.setItem('radar_fx_bio_user', userId);
                setStatus('registered');
                setCredentialCount(prev => prev + 1);
            } else {
                setErrorMsg(completeResp.data.error || 'Falha na verificação');
                setStatus('error');
            }
        } catch (e: any) {
            let msg = e.response?.data?.error || e.message || 'Erro desconhecido';
            console.error('[Biometria] FULL ERROR:', {
                name: e.name,
                message: e.message,
                response: e.response?.data,
                stack: e.stack?.slice(0, 300),
            });
            if (e.name === 'NotAllowedError') {
                msg = 'Registro cancelado ou navegador incompatível. Verifique se o Windows Hello (PIN/impressão digital) está configurado no Windows.';
            } else if (e.name === 'TypeError') {
                msg = 'Erro de configuração: ' + msg;
            }
            setErrorMsg(msg);
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${status === 'registered' ? 'bg-emerald-500/10' : status === 'error' ? 'bg-rose-500/10' : 'bg-slate-800'}`}>
                        {status === 'registered' ? (
                            <Fingerprint size={20} className="text-emerald-400" />
                        ) : status === 'error' ? (
                            <XCircle size={20} className="text-rose-400" />
                        ) : (
                            <Smartphone size={20} className="text-slate-400" />
                        )}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white">
                            {status === 'registered' ? 'Biometria Cadastrada' :
                             status === 'registering' ? 'Registrando...' :
                             status === 'error' ? 'Erro no Cadastro' :
                             'Nenhuma biometria cadastrada'}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                            {status === 'registered' ? `${credentialCount} credencial(is) ativa(s)` :
                             status === 'error' ? errorMsg :
                             'Use Windows Hello, Touch ID ou Face ID'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {status === 'registered' && (
                        <button
                            onClick={checkStatus}
                            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 transition-all"
                            title="Recarregar status"
                        >
                            <RefreshCw size={14} />
                        </button>
                    )}
                    <button
                        onClick={handleRegister}
                        disabled={loading || status === 'registering'}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                            status === 'registered'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                        {loading ? (
                            <><RefreshCw size={14} className="animate-spin" /> Aguarde...</>
                        ) : status === 'registered' ? (
                            <><Fingerprint size={14} /> Cadastrar Nova</>
                        ) : (
                            <><Lock size={14} /> Cadastrar Biometria</>
                        )}
                    </button>
                </div>
            </div>

            {status === 'registered' && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                    <Shield size={14} className="text-emerald-400 shrink-0" />
                    <p className="text-[11px] text-emerald-400/80">
                        Login biométrico ativo. Use sua impressão digital ou reconhecimento facial para acessar o Radar FX.
                    </p>
                </div>
            )}
        </div>
    );
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
    const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        array[i] = raw.charCodeAt(i);
    }
    return array;
}

function uint8ArrayToBase64Url(array: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < array.length; i++) {
        binary += String.fromCharCode(array[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
