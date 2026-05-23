import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

export interface UserProfile {
    name: string;
    tradingStyle: 'SCALPER' | 'DAY_TRADER' | 'SWING';
    experience: string;
}

export interface SystemConfig {
    polygonApiKey: string;
    mt5BridgeUrl: string;
    profile: UserProfile;
}

export class ConfigService {
    private static ENV_PATH = path.resolve(process.cwd(), '.env');
    private static PROFILE_PATH = path.resolve(process.cwd(), 'profile.json');

    static getConfig(): SystemConfig {
        // Reload env to get latest
        const envConfig = dotenv.parse(fs.readFileSync(this.ENV_PATH));

        let profile: UserProfile = {
            name: 'Alpha Discipline',
            tradingStyle: 'DAY_TRADER',
            experience: 'Master Trader Discipline'
        };

        if (fs.existsSync(this.PROFILE_PATH)) {
            try {
                profile = JSON.parse(fs.readFileSync(this.PROFILE_PATH, 'utf-8'));
            } catch (e) {
                console.error('Failed to parse profile.json');
            }
        }

        return {
            polygonApiKey: envConfig.POLYGON_API_KEY || '',
            mt5BridgeUrl: envConfig.MT5_BRIDGE_URL || 'http://127.0.0.1:5555',
            profile
        };
    }

    static saveConfig(config: Partial<SystemConfig>): boolean {
        try {
            if (config.polygonApiKey !== undefined || config.mt5BridgeUrl !== undefined) {
                this.updateEnv({
                    POLYGON_API_KEY: config.polygonApiKey,
                    MT5_BRIDGE_URL: config.mt5BridgeUrl
                });
            }

            if (config.profile) {
                fs.writeFileSync(this.PROFILE_PATH, JSON.stringify(config.profile, null, 2));
            }

            return true;
        } catch (error) {
            console.error('Error saving config:', error);
            return false;
        }
    }

    private static updateEnv(updates: Record<string, string | undefined>) {
        if (!fs.existsSync(this.ENV_PATH)) {
            fs.writeFileSync(this.ENV_PATH, '');
        }

        let content = fs.readFileSync(this.ENV_PATH, 'utf8');
        const lines = content.split('\n');

        for (const [key, value] of Object.entries(updates)) {
            if (value === undefined) continue;

            const lineIndex = lines.findIndex(line => line.startsWith(`${key}=`));
            if (lineIndex !== -1) {
                lines[lineIndex] = `${key}=${value}`;
            } else {
                lines.push(`${key}=${value}`);
            }
        }

        fs.writeFileSync(this.ENV_PATH, lines.join('\n').trim() + '\n');

        // Update process.env for current session
        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) process.env[key] = value;
        }
    }
}
