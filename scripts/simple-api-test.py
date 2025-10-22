#!/usr/bin/env python3
"""
Very simple API test to isolate the hanging issue
"""

from girder_client import GirderClient
import sys
import time


def simple_test(url, username, password):
    print(f"🔐 Testing basic connection to {url}")

    try:
        print("   Creating client...")
        gc = GirderClient(apiUrl=url)

        print("   Authenticating...")
        start_time = time.time()
        gc.authenticate(username=username, password=password)
        auth_time = time.time() - start_time
        print(f"   ✅ Authentication took {auth_time:.2f} seconds")

        print("   Testing user info...")
        start_time = time.time()
        user_info = gc.get("user/me")
        user_time = time.time() - start_time
        print(f"   ✅ User info took {user_time:.2f} seconds")
        print(f"   User: {user_info.get('login', 'Unknown')}")

        return True

    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python simple-api-test.py <url> <username> <password>")
        sys.exit(1)

    url, username, password = sys.argv[1:4]

    if simple_test(url, username, password):
        print("\n✅ Basic API connection works!")
    else:
        print("\n❌ Basic API connection failed!")
        sys.exit(1)
