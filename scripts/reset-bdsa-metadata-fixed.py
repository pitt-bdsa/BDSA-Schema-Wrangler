#!/usr/bin/env python3
"""
Fixed version of the BDSA metadata reset script that uses working authentication
"""

from girder_client import GirderClient
import argparse
import sys
import time


def reset_item_bdsa_metadata(gc, item_id):
    """Reset BDSA metadata for a single item by setting it to an empty object."""
    try:
        # Send empty BDSA structure to reset the metadata
        metadata = {"BDSA": {"bdsaLocal": {}}}

        # Use the metadata endpoint to update
        gc.addMetadataToItem(item_id, metadata)

        return {
            "success": True,
            "item_id": item_id,
            "message": "BDSA metadata reset successfully",
        }
    except Exception as e:
        return {"success": False, "item_id": item_id, "error": str(e)}


def get_all_items_working(gc, resource_id, resource_type="folder", page_size=100):
    """
    Fetch all items using a working method that doesn't hang
    """
    print(
        f"📥 Fetching items from {resource_type} {resource_id} (working method, {page_size} items per page)..."
    )

    all_items = []
    offset = 0
    page_num = 0

    while True:
        page_num += 1
        print(f"   📄 Fetching page {page_num} (offset {offset})...")

        try:
            start_time = time.time()

            # Use the same method that works for fetching items with metadata
            items_list = list(
                gc.listResource(
                    f"resource/{resource_id}/items",
                    params={
                        "type": resource_type,
                        "limit": page_size,
                        "offset": offset,
                    },
                )
            )

            fetch_time = time.time() - start_time
            print(f"      ✅ API call completed in {fetch_time:.2f} seconds")

        except Exception as e:
            print(f"      ❌ Error fetching page {page_num}: {e}")
            break

        if not items_list:
            print(f"      No more items found, stopping pagination")
            break

        all_items.extend(items_list)
        print(f"      Got {len(items_list)} items (total so far: {len(all_items)})")

        # If we got fewer items than page_size, we're done
        if len(items_list) < page_size:
            print(
                f"      Got fewer items than page size ({len(items_list)} < {page_size}), stopping pagination"
            )
            break

        offset += page_size

    print(f"✅ Found {len(all_items)} total items across {page_num} pages")
    return all_items


def main():
    parser = argparse.ArgumentParser(
        description="Reset BDSA metadata for all items in a DSA resource (fixed version)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Reset folder items
  python reset-bdsa-metadata-fixed.py --url http://bdsa.pathology.emory.edu:8080/api/v1 \\
                                    --resource-id 673133b9900c0c05599779ab \\
                                    --resource-type folder \\
                                    --username admin \\
                                    --password Bm1Bl0wz!
        """,
    )

    parser.add_argument("--url", required=True, help="DSA server URL")
    parser.add_argument("--resource-id", required=True, help="Resource ID to process")
    parser.add_argument(
        "--resource-type",
        default="folder",
        choices=["folder", "collection"],
        help="Resource type",
    )
    parser.add_argument("--username", help="Username for authentication")
    parser.add_argument("--password", help="Password for authentication")
    parser.add_argument(
        "--page-size", type=int, default=100, help="Items per page (default: 100)"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=10,
        help="Progress update frequency (default: 10)",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Preview changes without updating"
    )

    args = parser.parse_args()

    # Authenticate with Girder
    print(f"🔐 Connecting to {args.url}...")
    gc = GirderClient(apiUrl=args.url)

    try:
        if args.username and args.password:
            print(f"   Authenticating as {args.username}...")
            gc.authenticate(username=args.username, password=args.password)
        else:
            print("   No credentials provided, using interactive authentication...")
            gc.authenticate(interactive=True)

        print("✅ Authentication successful")
    except Exception as e:
        print(f"❌ Authentication failed: {e}", file=sys.stderr)
        sys.exit(1)

    # Fetch all items using the working method
    try:
        items = get_all_items_working(
            gc, args.resource_id, args.resource_type, args.page_size
        )
    except Exception as e:
        print(f"❌ Failed to fetch items: {e}", file=sys.stderr)
        sys.exit(1)

    if not items:
        print("⚠️  No items found in the resource")
        sys.exit(0)

    # Debug: Check the first few items to see their metadata structure
    print(f"\n🔍 DEBUG: Checking metadata structure of first 3 items...")
    for i, item in enumerate(items[:3]):
        item_name = item.get("name", "Unknown")
        meta = item.get("meta", {})
        print(f"   Item {i+1} ({item_name}):")
        print(f"      meta keys: {list(meta.keys())}")
        if "bdsaLocal" in meta:
            print(f"      bdsaLocal keys: {list(meta['bdsaLocal'].keys())}")
        if "BDSA" in meta:
            print(f"      BDSA keys: {list(meta['BDSA'].keys())}")
            if "bdsaLocal" in meta["BDSA"]:
                print(
                    f"      BDSA.bdsaLocal keys: {list(meta['BDSA']['bdsaLocal'].keys())}"
                )
        print(f"      Full meta: {meta}")
        print()

    # Filter items to only those with BDSA metadata (checking for BDSA.bdsaLocal)
    items_with_bdsa = [
        item for item in items if item.get("meta", {}).get("BDSA", {}).get("bdsaLocal")
    ]
    items_without_bdsa = len(items) - len(items_with_bdsa)

    print(f"\n📊 Items with BDSA metadata: {len(items_with_bdsa)}/{len(items)}")
    print(f"   Items without BDSA metadata (will skip): {items_without_bdsa}")

    if not items_with_bdsa:
        print("\n✅ No items have BDSA metadata - nothing to reset!")
        sys.exit(0)

    # Process items
    if args.dry_run:
        print(
            f"\n🔍 DRY RUN MODE - Would reset BDSA metadata for {len(items_with_bdsa)} items:"
        )
        for i, item in enumerate(items_with_bdsa, 1):
            item_id = item.get("_id")
            item_name = item.get("name", "Unknown")
            bdsa_keys = list(
                item.get("meta", {}).get("BDSA", {}).get("bdsaLocal", {}).keys()
            )
            print(
                f"   [{i}/{len(items_with_bdsa)}] {item_name} ({item_id}) - BDSA keys: {bdsa_keys}"
            )
        print(
            f"\n✅ Dry run complete. Would reset {len(items_with_bdsa)} items, skip {items_without_bdsa}."
        )
        sys.exit(0)

    print(f"\n🔄 Resetting BDSA metadata for {len(items_with_bdsa)} items...")
    print(f"⚠️  WARNING: This will clear all BDSA metadata from these items!")
    print(f"   ({items_without_bdsa} items without BDSA metadata will be skipped)")

    response = input("Continue? (yes/no): ")
    if response.lower() not in ["yes", "y"]:
        print("❌ Cancelled by user")
        sys.exit(0)

    success_count = 0
    error_count = 0
    errors = []

    for i, item in enumerate(items_with_bdsa, 1):
        item_id = item.get("_id")
        item_name = item.get("name", "Unknown")

        result = reset_item_bdsa_metadata(gc, item_id)

        if result["success"]:
            success_count += 1
            if i % args.batch_size == 0 or i == len(items_with_bdsa):
                print(
                    f"   ✅ Processed {i}/{len(items_with_bdsa)} items ({success_count} successful, {error_count} errors)"
                )
        else:
            error_count += 1
            error_msg = f"Item {item_name} ({item_id}): {result['error']}"
            errors.append(error_msg)
            print(f"   ❌ Error: {error_msg}")

    # Summary
    print(f"\n{'='*60}")
    print(f"📊 SUMMARY")
    print(f"{'='*60}")
    print(f"Total items in resource: {len(items)}")
    print(f"Items with BDSA metadata: {len(items_with_bdsa)}")
    print(f"Items without BDSA metadata (skipped): {items_without_bdsa}")
    print(f"✅ Successfully reset: {success_count}")
    print(f"❌ Errors: {error_count}")

    if errors:
        print(f"\n❌ Errors encountered:")
        for error in errors:
            print(f"   • {error}")

    if error_count > 0:
        sys.exit(1)
    else:
        print("\n✅ All BDSA metadata has been reset successfully!")
        print("   You can now start fresh with clean metadata.")


if __name__ == "__main__":
    main()
