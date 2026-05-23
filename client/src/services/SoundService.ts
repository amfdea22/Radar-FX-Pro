export class SoundService {
    private static audioCtx: AudioContext | null = null;

    private static init() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
    }

    static playNotification() {
        this.init();
        if (!this.audioCtx) return;

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, this.audioCtx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(1320, this.audioCtx.currentTime + 0.1); // E6

        gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, this.audioCtx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.5);
    }

    static playAlert() {
        this.init();
        if (!this.audioCtx) return;

        const now = this.audioCtx.currentTime;
        const gain = this.audioCtx.createGain();
        gain.connect(this.audioCtx.destination);

        // Som de sirene/alerta (dois tons alternados)
        const playTone = (freq: number, start: number) => {
            const osc = this.audioCtx!.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, start);
            osc.connect(gain);
            osc.start(start);
            osc.stop(start + 0.2);
        };

        gain.gain.setValueAtTime(0.1, now);
        playTone(440, now);
        playTone(330, now + 0.25);
        playTone(440, now + 0.5);
        playTone(330, now + 0.75);
    }
}
