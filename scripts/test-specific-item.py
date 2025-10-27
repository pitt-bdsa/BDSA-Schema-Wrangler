#!/usr/bin/env python3
"""
Test script to fetch a specific item and examine its metadata structure
"""

from girder_client import GirderClient
import json


def test_specific_item(url, item_id, username, password):
    print(f"🔐 Testing specific item fetch from {url}")

    try:
        print("   Authenticating...")
        gc = GirderClient(apiUrl=url)
        gc.authenticate(username=username, password=password)
        print("✅ Authentication successful")
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        return False

    try:
        print(f"🔍 Fetching item {item_id}...")
        item = gc.getItem(item_id)

        print(f"✅ Item fetched successfully!")
        print(f"   Name: {item.get('name', 'Unknown')}")
        print(f"   ID: {item.get('_id', 'Unknown')}")

        # Check metadata structure
        meta = item.get("meta", {})
        print(f"\n📊 Metadata structure:")
        print(f"   meta keys: {list(meta.keys())}")

        if "BDSA" in meta:
            print(f"   ✅ Found meta.BDSA")
            bdsa = meta["BDSA"]
            print(f"   BDSA keys: {list(bdsa.keys())}")

            if "bdsaLocal" in bdsa:
                print(f"   ✅ Found meta.BDSA.bdsaLocal")
                bdsa_local = bdsa["bdsaLocal"]
                print(f"   bdsaLocal keys: {list(bdsa_local.keys())}")
                print(f"   bdsaLocal content: {json.dumps(bdsa_local, indent=2)}")
            else:
                print(f"   ❌ No bdsaLocal in BDSA")
        else:
            print(f"   ❌ No BDSA in meta")

        if "bdsaLocal" in meta:
            print(f"   ✅ Found meta.bdsaLocal (direct)")
            bdsa_local = meta["bdsaLocal"]
            print(f"   bdsaLocal keys: {list(bdsa_local.keys())}")
            print(f"   bdsaLocal content: {json.dumps(bdsa_local, indent=2)}")

        print(f"\n🔍 Full metadata:")
        print(json.dumps(meta, indent=2))

        return True

    except Exception as e:
        print(f"❌ Failed to fetch item: {e}")
        return False


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 5:
        print(
            "Usage: python test-specific-item.py <url> <item_id> <username> <password>"
        )
        sys.exit(1)

    url, item_id, username, password = sys.argv[1:5]

    if test_specific_item(url, item_id, username, password):
        print("\n✅ Item fetch successful!")
    else:
        print("\n❌ Item fetch failed!")
        sys.exit(1)





