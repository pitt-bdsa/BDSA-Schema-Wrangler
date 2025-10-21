#!/usr/bin/env python3
"""
Quick test script to check API connection and pagination
"""

from girder_client import GirderClient
import sys


def test_api_connection(url, resource_id, username, password):
    print(f"🔐 Testing connection to {url}")
    gc = GirderClient(apiUrl=url)

    try:
        print("   Authenticating...")
        gc.authenticate(username=username, password=password)
        print("✅ Authentication successful")
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        return False

    try:
        print("🔍 Testing single item fetch (as folder)...")
        try:
            items = list(
                gc.listResource(
                    f"resource/{resource_id}/items",
                    params={"type": "folder", "limit": 1, "offset": 0},
                )
            )
            print(f"✅ Folder fetch successful - got {len(items)} items")
            resource_type = "folder"
        except Exception as folder_error:
            print(f"   Folder fetch failed: {folder_error}")
            print("🔍 Testing single item fetch (as collection)...")
            items = list(
                gc.listResource(
                    f"resource/{resource_id}/items",
                    params={"type": "collection", "limit": 1, "offset": 0},
                )
            )
            print(f"✅ Collection fetch successful - got {len(items)} items")
            resource_type = "collection"

        if items:
            print(f"   Sample item: {items[0].get('name', 'Unknown')}")
            print(f"   Has BDSA metadata: {bool(items[0].get('meta', {}).get('BDSA'))}")

    except Exception as e:
        print(f"❌ Single item fetch failed: {e}")
        return False

    try:
        print("🔍 Testing pagination (first 3 pages)...")
        for page in range(1, 4):
            offset = (page - 1) * 10
            print(f"   Page {page} (offset {offset})...")
            items = list(
                gc.listResource(
                    f"resource/{resource_id}/items",
                    params={"type": resource_type, "limit": 10, "offset": offset},
                )
            )
            print(f"      Got {len(items)} items")
            if len(items) == 0:
                print(f"      No more items, stopping at page {page}")
                break
        print("✅ Pagination test successful")

    except Exception as e:
        print(f"❌ Pagination test failed: {e}")
        return False

    return True


if __name__ == "__main__":
    if len(sys.argv) != 5:
        print(
            "Usage: python test-api-connection.py <url> <resource_id> <username> <password>"
        )
        sys.exit(1)

    url, resource_id, username, password = sys.argv[1:5]

    if test_api_connection(url, resource_id, username, password):
        print("\n✅ All tests passed! The API connection is working.")
    else:
        print("\n❌ Tests failed. Check the error messages above.")
        sys.exit(1)
