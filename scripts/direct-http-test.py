#!/usr/bin/env python3
"""
Test using direct HTTP requests instead of girder_client
"""

import requests
import sys
import json


def test_direct_http(url, resource_id, username, password):
    print(f"🔐 Testing direct HTTP to {url}")

    # First, get authentication token
    auth_url = f"{url}/user/authentication"
    auth_data = {"username": username, "password": password}

    try:
        print("   Getting authentication token...")
        auth_response = requests.post(auth_url, json=auth_data, timeout=30)
        auth_response.raise_for_status()
        token = auth_response.json()["authToken"]["token"]
        print(f"   ✅ Got token: {token[:20]}...")

        # Test the resource endpoint directly
        headers = {"Girder-Token": token, "Content-Type": "application/json"}

        print("   Testing folder endpoint...")
        folder_url = f"{url}/resource/{resource_id}/items"
        folder_params = {"type": "folder", "limit": 1, "offset": 0}

        start_time = time.time()
        folder_response = requests.get(
            folder_url, headers=headers, params=folder_params, timeout=30
        )
        folder_time = time.time() - start_time

        if folder_response.status_code == 200:
            folder_data = folder_response.json()
            print(
                f"   ✅ Folder endpoint worked in {folder_time:.2f}s - got {len(folder_data)} items"
            )
            return "folder", folder_data
        else:
            print(
                f"   ❌ Folder failed: {folder_response.status_code} - {folder_response.text}"
            )

        print("   Testing collection endpoint...")
        collection_params = {"type": "collection", "limit": 1, "offset": 0}

        start_time = time.time()
        collection_response = requests.get(
            folder_url, headers=headers, params=collection_params, timeout=30
        )
        collection_time = time.time() - start_time

        if collection_response.status_code == 200:
            collection_data = collection_response.json()
            print(
                f"   ✅ Collection endpoint worked in {collection_time:.2f}s - got {len(collection_data)} items"
            )
            return "collection", collection_data
        else:
            print(
                f"   ❌ Collection failed: {collection_response.status_code} - {collection_response.text}"
            )

        return None, None

    except requests.exceptions.Timeout:
        print("   ❌ Request timed out - server might be slow or unresponsive")
        return None, None
    except Exception as e:
        print(f"   ❌ Request failed: {e}")
        return None, None


if __name__ == "__main__":
    import time

    print(f"Debug: Received {len(sys.argv)} arguments: {sys.argv}")
    
    if len(sys.argv) != 5:  # Script name + 4 args
        print(
            "Usage: python direct-http-test.py <url> <resource_id> <username> <password>"
        )
        print(f"Expected 5 arguments (including script name), got {len(sys.argv)}")
        sys.exit(1)

    url, resource_id, username, password = sys.argv[1:5]

    resource_type, data = test_direct_http(url, resource_id, username, password)

    if resource_type:
        print(f"\n✅ Direct HTTP works! Resource type: {resource_type}")
        if data:
            print(f"   Sample item: {data[0].get('name', 'Unknown')}")
            print(f"   Has BDSA metadata: {bool(data[0].get('meta', {}).get('BDSA'))}")
    else:
        print("\n❌ Direct HTTP failed!")
        sys.exit(1)
