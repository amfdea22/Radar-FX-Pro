import MetaTrader5 as mt5
import sys

def test_login(login, password, server):
    if not mt5.initialize():
        print(f"Initialize failed, error: {mt5.last_error()}")
        return

    print(f"Terminal info: {mt5.terminal_info()}")
    print(f"Version: {mt5.version()}")
    
    authorized = mt5.login(int(login), password=password, server=server)
    if not authorized:
        print(f"Login failed for {login} on {server}")
        print(f"Last error: {mt5.last_error()}")
    else:
        print(f"Login successful for {login} on {server}")
        print(f"Account info: {mt5.account_info()}")

    mt5.shutdown()

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python test_mt5_login.py <login> <password> <server>")
    else:
        test_login(sys.argv[1], sys.argv[2], sys.argv[3])
