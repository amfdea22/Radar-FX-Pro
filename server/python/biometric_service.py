import json
import os
import base64
import time
import hmac
import hashlib
from flask import Flask, request, jsonify
from flask_cors import CORS
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
)
from webauthn.helpers import options_to_json
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

app = Flask(__name__)
CORS(app)

JWT_SECRET = os.environ.get('JWT_SECRET', 'radar-fx-secret-key-change-in-production')

def jwt_encode(payload, secret=JWT_SECRET, expires_in=86400):
    header = base64.urlsafe_b64encode(json.dumps({'alg': 'HS256', 'typ': 'JWT'}).encode()).rstrip(b'=').decode()
    payload['exp'] = int(time.time()) + expires_in
    payload['iat'] = int(time.time())
    payload_str = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b'=').decode()
    message = f'{header}.{payload_str}'.encode()
    sig = base64.urlsafe_b64encode(hmac.new(secret.encode(), message, hashlib.sha256).digest()).rstrip(b'=').decode()
    return f'{header}.{payload_str}.{sig}'

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
os.makedirs(DATA_DIR, exist_ok=True)
CREDENTIALS_FILE = os.path.join(DATA_DIR, 'biometric_credentials.json')
CHALLENGES_FILE = os.path.join(DATA_DIR, 'biometric_challenges.json')

RP_ID = 'localhost'
RP_NAME = 'Radar FX Central de Seguranca'
ORIGIN = 'http://localhost:3009'

def load_json(path):
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return {}

def save_json(path, data):
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

@app.route('/api/biometria/register/begin', methods=['POST'])
def register_begin():
    data = request.get_json() or {}
    user_name = data.get('userName', 'trader@radarfx.com')
    user_id = data.get('userId', 'radar-fx-user-001')

    credentials = load_json(CREDENTIALS_FILE)
    if user_id not in credentials:
        credentials[user_id] = {'username': user_name, 'credentials': []}

    exclude_creds = []
    for uid, info in credentials.items():
        for c in info.get('credentials', []):
            exclude_creds.append({
                'type': 'public-key',
                'id': c['id']
            })

    options = generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_name=user_name,
        user_id=user_id.encode('utf-8'),
        user_display_name=user_name,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
        exclude_credentials=exclude_creds,
    )

    options_dict = json.loads(options_to_json(options))
    challenge_b64 = options_dict['challenge']

    challenges = load_json(CHALLENGES_FILE)
    challenges[user_id] = {
        'challenge': challenge_b64,
        'type': 'registration',
    }
    save_json(CHALLENGES_FILE, challenges)

    return jsonify(options_dict)

@app.route('/api/biometria/register/complete', methods=['POST'])
def register_complete():
    data = request.get_json() or {}
    credential = data.get('credential')
    user_id = data.get('userId', 'radar-fx-user-001')

    if not credential:
        return jsonify({'verified': False, 'error': 'Missing credential'}), 400

    challenges = load_json(CHALLENGES_FILE)
    challenge_data = challenges.get(user_id)
    if not challenge_data or challenge_data.get('type') != 'registration':
        return jsonify({'verified': False, 'error': 'No registration challenge found'}), 400

    stored_challenge = challenge_data['challenge']
    challenges.pop(user_id, None)
    save_json(CHALLENGES_FILE, challenges)

    try:
        verification = verify_registration_response(
            credential=credential,
            expected_challenge=stored_challenge,
            expected_rp_id=RP_ID,
            expected_origin=ORIGIN,
        )
    except Exception as e:
        return jsonify({'verified': False, 'error': str(e)}), 400

    cred_id = verification.credential_id
    cred_id_b64 = base64.b64encode(cred_id).decode('utf-8') if isinstance(cred_id, bytes) else cred_id

    new_cred = {
        'id': cred_id_b64,
        'publicKey': base64.b64encode(verification.credential_public_key).decode('utf-8') if isinstance(verification.credential_public_key, bytes) else verification.credential_public_key,
        'signCount': verification.sign_count,
        'transports': credential.get('response', {}).get('transports', []),
    }

    credentials = load_json(CREDENTIALS_FILE)
    if user_id not in credentials:
        credentials[user_id] = {'username': 'trader@radarfx.com', 'credentials': []}
    credentials[user_id]['credentials'].append(new_cred)
    save_json(CREDENTIALS_FILE, credentials)

    return jsonify({'verified': True, 'credentialId': cred_id_b64})

@app.route('/api/biometria/login/begin', methods=['POST'])
def login_begin():
    data = request.get_json() or {}
    user_id = data.get('userId', 'radar-fx-user-001')

    credentials = load_json(CREDENTIALS_FILE)
    user_info = credentials.get(user_id, {})
    user_creds = user_info.get('credentials', []) if isinstance(user_info, dict) else []
    if not user_creds:
        return jsonify({'error': 'No biometric credentials registered'}), 404

    allow_creds = []
    for c in user_creds:
        try:
            cid = base64.b64decode(c['id'])
        except Exception:
            cid = c['id']
        allow_creds.append({
            'type': 'public-key',
            'id': cid,
        })

    options = generate_authentication_options(
        rp_id=RP_ID,
        allow_credentials=allow_creds,
        user_verification=UserVerificationRequirement.PREFERRED,
    )

    options_dict = json.loads(options_to_json(options))
    challenge_b64 = options_dict['challenge']

    challenges = load_json(CHALLENGES_FILE)
    challenges[user_id] = {
        'challenge': challenge_b64,
        'type': 'authentication',
    }
    save_json(CHALLENGES_FILE, challenges)

    return jsonify(options_dict)

@app.route('/api/biometria/login/complete', methods=['POST'])
def login_complete():
    data = request.get_json() or {}
    credential = data.get('credential')
    user_id = data.get('userId', 'radar-fx-user-001')

    if not credential:
        return jsonify({'verified': False, 'error': 'Missing credential'}), 400

    challenges = load_json(CHALLENGES_FILE)
    challenge_data = challenges.get(user_id)
    if not challenge_data or challenge_data.get('type') != 'authentication':
        return jsonify({'verified': False, 'error': 'No authentication challenge found'}), 400

    stored_challenge = challenge_data['challenge']
    challenges.pop(user_id, None)
    save_json(CHALLENGES_FILE, challenges)

    credentials = load_json(CREDENTIALS_FILE)
    user_info = credentials.get(user_id, {})
    user_creds = user_info.get('credentials', []) if isinstance(user_info, dict) else user_info
    if not user_creds:
        return jsonify({'verified': False, 'error': 'No credentials found'}), 404

    stored_username = user_info.get('username', user_id) if isinstance(user_info, dict) else user_id

    cred_id_from_client = credential.get('id', '')
    stored_cred = None
    for c in user_creds:
        if c['id'] == cred_id_from_client:
            stored_cred = c
            break

    if not stored_cred:
        return jsonify({'verified': False, 'error': 'Credential not found'}), 404

    try:
        pubkey_bytes = base64.b64decode(stored_cred['publicKey'])
    except Exception:
        pubkey_bytes = stored_cred['publicKey']

    try:
        verification = verify_authentication_response(
            credential=credential,
            expected_challenge=stored_challenge,
            expected_rp_id=RP_ID,
            expected_origin=ORIGIN,
            credential_public_key=pubkey_bytes,
            credential_current_sign_count=stored_cred.get('signCount', 0),
        )
    except Exception as e:
        return jsonify({'verified': False, 'error': str(e)}), 400

    for c in user_creds:
        if c['id'] == cred_id_from_client:
            c['signCount'] = verification.new_sign_count
            break
    credentials[user_id] = user_info
    save_json(CREDENTIALS_FILE, credentials)

    token = jwt_encode({'username': stored_username})
    return jsonify({'verified': True, 'token': token, 'username': stored_username, 'newSignCount': verification.new_sign_count})

@app.route('/api/biometria/status', methods=['GET'])
def status():
    credentials = load_json(CREDENTIALS_FILE)
    user_id = request.args.get('userId', 'radar-fx-user-001')
    user_info = credentials.get(user_id, {})
    user_creds = user_info.get('credentials', []) if isinstance(user_info, dict) else user_info
    return jsonify({
        'registered': len(user_creds) > 0,
        'credentialCount': len(user_creds),
    })

if __name__ == '__main__':
    print(f'Biometric Service running on port 5001')
    app.run(host='0.0.0.0', port=5001, debug=False)
