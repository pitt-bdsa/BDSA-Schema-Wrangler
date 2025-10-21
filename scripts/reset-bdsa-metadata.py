#!/usr/bin/env python3
"""
Script to reset/clear BDSA metadata from all items in a resource.
This will fetch all items from a folder/collection and set BDSA to an empty object.
"""

from girder_client import GirderClient
import argparse
import sys
import re
from typing import Optional, Dict, List


# BDSA Protocol Mappings (from your protocol data)
REGION_PROTOCOLS = {
    "Middle Frontal Gyrus": "REGION_vfrsko",
    "Midbrain": "REGION_0zgdpo",
    "Amygdala": "REGION_ttuyui",
    "Pons": "REGION_oovu1y",
    "Medulla": "REGION_l4sjfj",
    "Thalamus": "REGION_9yqilx",
    "Parietal Lobe": "REGION_d8crva",
    "SM Temporal Gyrus": "REGION_ni741c",
    "Cerebellum": "REGION_rczxxd",
    "Inferior Parietal Lobe": "REGION_no8hid",
}

STAIN_PROTOCOLS = {
    "H&E": "STAIN_cpioo6",
    "Modified Bielchowski": "STAIN_65v352",
    "Synuclein": "STAIN_lkwpqy",
    "Tau": "STAIN_qfddqt",
    "aBeta": "STAIN_p2d518",
    "amyB": "STAIN_kng23v",
    "LFB": "STAIN_tns7si",
}

# Stain name mappings from filename abbreviations
STAIN_NAME_MAPPING = {
    "Sil": "Modified Bielchowski",
    "AmyB": "amyB",
    "HE": "H&E",
    "Tau": "Tau",
    "Syn": "Synuclein",
    "LFB": "LFB",
    "LFB-PAS": "LFB",  # Map LFB-PAS to LFB for now
    "Thio": "Tau",  # Map Thioflavin S to Tau for now
}


def parse_filename(filename: str) -> Dict[str, str]:
    """
    Parse filename to extract local case ID, region, and stain information.

    Supports multiple formats with fallback patterns:
    1. 550058_2_Sil_1.mrxs (underscore format)
    2. 20232824 B TDP43_LabelArea_Image.optimized.tiff (space format)
    3. 20243819 H PTDP43_Default_Extended.optimized.tiff (extended format)
    """
    # Remove file extension
    base_name = filename.split(".")[0]

    # Define multiple patterns to try in order
    patterns = [
        # Pattern 1: underscore format - digits_regionNumber_stain_slideNumber
        {
            "pattern": r"^(\d+)_(\d+)_([A-Za-z0-9_-]+)_(\d+)$",
            "groups": ["localCaseId", "regionNumber", "localStainID", "slideNumber"],
        },
        # Pattern 2: space format - digits region stain_imageType
        {
            "pattern": r"^(\d+)\s+(\w+)\s+(\w+)_(\w+)$",
            "groups": ["localCaseId", "localRegionId", "localStainID", "imageType"],
        },
        # Pattern 3: extended format - digits region stain_Default_Extended
        {
            "pattern": r"^(\d+)\s+(\w+)\s+(\w+)_(\w+)_(\w+)$",
            "groups": [
                "localCaseId",
                "localRegionId",
                "localStainID",
                "imageType",
                "extendedType",
            ],
        },
    ]

    # Try each pattern until one matches
    for pattern_info in patterns:
        match = re.match(pattern_info["pattern"], base_name)
        if match:
            result = {}
            for i, group_name in enumerate(pattern_info["groups"], 1):
                result[group_name] = match.group(i)
            return result

    return {}


def get_region_name_from_filename(filename: str) -> Optional[str]:
    """
    Extract region name from filename by parsing the region number and mapping to region name.
    This is a simplified approach - you might need more sophisticated logic.
    """
    parsed = parse_filename(filename)
    if not parsed:
        return None

    # For now, return None - you'll need to implement region detection logic
    # based on your specific requirements (region number mapping)
    return None


def get_stain_name_from_filename(filename: str) -> Optional[str]:
    """
    Extract stain name from filename.
    """
    parsed = parse_filename(filename)
    if not parsed:
        return None

    stain_abbrev = parsed.get("localStainID", "")
    stain_name = STAIN_NAME_MAPPING.get(stain_abbrev, stain_abbrev)

    # Return the full stain name (not GUID) for display
    return stain_name


def fix_item_bdsa_metadata(gc: GirderClient, item_id: str, item_name: str) -> dict:
    """
    Fix BDSA metadata for a single item by setting proper names from filename.
    Uses internal GUID mapping for consistency but stores names for display.

    Args:
        gc: Authenticated GirderClient
        item_id: The item ID to fix
        item_name: The filename to parse for region/stain info

    Returns:
        dict with success status and details
    """
    try:
        # Parse filename to get stain name
        stain_name = get_stain_name_from_filename(item_name)
        region_name = get_region_name_from_filename(item_name)

        if not stain_name:
            return {
                "success": False,
                "item_id": item_id,
                "error": f"Could not determine stain name from filename: {item_name}",
            }

        # Extract case ID from filename
        case_id = item_name.split("_")[0]
        stain_abbrev = item_name.split("_")[2]

        # Build proper BDSA metadata structure using NAMES for display
        bdsa_local = {
            "bdsaCaseId": f"BDSA-501-{case_id}",
            "bdsaRegionProtocol": [region_name] if region_name else [],
            "bdsaStainProtocol": [stain_name],
            "lastUpdated": "2025-10-20T16:12:48.641Z",
            "localCaseId": case_id,
            "localRegionId": region_name or "Unknown",
            "localStainID": stain_name,  # Full stain name, not abbreviation
            "source": "BDSA-Schema-Wrangler",
        }

        metadata = {"BDSA": {"bdsaLocal": bdsa_local}}

        # Use the metadata endpoint to update
        gc.addMetadataToItem(item_id, metadata)

        return {
            "success": True,
            "item_id": item_id,
            "message": f"BDSA metadata fixed with stain: {stain_name}",
        }
    except Exception as e:
        return {"success": False, "item_id": item_id, "error": str(e)}


def get_all_items_paginated(
    gc: GirderClient,
    resource_id: str,
    resource_type: str = "folder",
    page_size: int = 500,
) -> list:
    """
    Fetch all items from a resource using pagination with recursive lookup.
    The API endpoint automatically does recursive lookup, so we just need to handle paging.

    Args:
        gc: Authenticated GirderClient
        resource_id: The resource (folder/collection) ID
        resource_type: Type of resource ('folder' or 'collection')
        page_size: Number of items per page

    Returns:
        List of items
    """
    print(
        f"📥 Fetching items from {resource_type} {resource_id} (recursive, paginated, {page_size} items per page)..."
    )

    all_items = []
    offset = 0
    page_num = 0

    while True:
        page_num += 1
        print(f"   📄 Fetching page {page_num} (offset {offset})...")

        try:
            # Fetch one page with timeout
            import time

            start_time = time.time()
            url = f"resource/{resource_id}/items"
            params = {
                "type": resource_type,
                "limit": page_size,
                "offset": offset,
            }
            print(f"      Making API call to: {url}")
            print(f"      Params: {params}")

            response = gc.get(url, parameters=params)
            items = response

            fetch_time = time.time() - start_time
            print(f"      ✅ API call completed in {fetch_time:.2f} seconds")
            print(f"      📊 Retrieved {len(items)} items")

        except Exception as e:
            print(f"      ❌ Error fetching page {page_num}: {e}")
            print(f"      Retrying with smaller page size...")
            # Try with smaller page size
            try:
                smaller_page_size = min(100, page_size)
                retry_params = {
                    "type": resource_type,
                    "limit": smaller_page_size,
                    "offset": offset,
                }
                items = gc.get(f"resource/{resource_id}/items", parameters=retry_params)
                print(f"      ✅ Retry successful with page size {smaller_page_size}")
            except Exception as retry_error:
                print(f"      ❌ Retry failed: {retry_error}")
                break

        if not items:
            print(f"      No more items found, stopping pagination")
            break

        all_items.extend(items)
        print(f"      Got {len(items)} items (total so far: {len(all_items)})")

        # If we got fewer items than page_size, we're done
        if len(items) < page_size:
            print(
                f"      Got fewer items than page size ({len(items)} < {page_size}), stopping pagination"
            )
            break

        offset += page_size

    print(f"✅ Found {len(all_items)} total items across {page_num} pages")
    return all_items


def get_all_items(
    gc: GirderClient, resource_id: str, resource_type: str = "folder"
) -> list:
    """
    Fetch all items from a resource using the recurse endpoint (single request).

    Args:
        gc: Authenticated GirderClient
        resource_id: The resource (folder/collection) ID
        resource_type: Type of resource ('folder' or 'collection')

    Returns:
        List of items
    """
    print(
        f"📥 Fetching all items from {resource_type} {resource_id} (single request)..."
    )

    # Use the resource endpoint with limit=0 to get all items at once
    items = list(
        gc.listResource(
            f"resource/{resource_id}/items", params={"type": resource_type, "limit": 0}
        )
    )

    print(f"✅ Found {len(items)} items")
    return items


def main():
    parser = argparse.ArgumentParser(
        description="Reset BDSA metadata for all items in a DSA resource",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Interactive login, reset folder items
  python reset-bdsa-metadata.py --url https://megabrain.neurology.emory.edu/api/v1 \\
                                  --resource-id 507f1f77bcf86cd799439011 \\
                                  --resource-type folder

  # Large collection (pagination is now default, automatically recursive)
  python reset-bdsa-metadata.py --url https://megabrain.neurology.emory.edu/api/v1 \\
                                  --resource-id 507f1f77bcf86cd799439011

  # For very large collections, use smaller page sizes
  python reset-bdsa-metadata.py --url https://megabrain.neurology.emory.edu/api/v1 \\
                                  --resource-id 507f1f77bcf86cd799439011 \\
                                  --page-size 25

  # Using token, reset collection items
  python reset-bdsa-metadata.py --url https://megabrain.neurology.emory.edu/api/v1 \\
                                  --resource-id 507f1f77bcf86cd799439011 \\
                                  --resource-type collection \\
                                  --token YOUR_API_TOKEN

  # With username/password
  python reset-bdsa-metadata.py --url https://megabrain.neurology.emory.edu/api/v1 \\
                                  --resource-id 507f1f77bcf86cd799439011 \\
                                  --username myuser \\
                                  --password mypass
        """,
    )

    parser.add_argument(
        "--url",
        required=True,
        help="DSA server URL (e.g., https://megabrain.neurology.emory.edu/api/v1)",
    )
    parser.add_argument(
        "--resource-id",
        required=True,
        help="Resource ID (folder or collection ID) to process",
    )
    parser.add_argument(
        "--resource-type",
        default="folder",
        choices=["folder", "collection"],
        help="Type of resource (default: folder)",
    )
    parser.add_argument(
        "--token",
        help="API token for authentication (alternative to username/password)",
    )
    parser.add_argument("--username", help="Username for authentication")
    parser.add_argument("--password", help="Password for authentication")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without actually updating items",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=10,
        help="Number of items to process before showing progress (default: 10)",
    )
    parser.add_argument(
        "--use-pagination",
        action="store_true",
        default=True,
        help="Use pagination to fetch items (default: True, recommended for large collections)",
    )
    parser.add_argument(
        "--no-pagination",
        action="store_true",
        help="Disable pagination and fetch all items at once (not recommended for large collections)",
    )
    parser.add_argument(
        "--page-size",
        type=int,
        default=50,
        help="Number of items per page when using pagination (default: 50, matches API example)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=30,
        help="Timeout in seconds for each API call (default: 30)",
    )

    args = parser.parse_args()

    # Authenticate with Girder
    print(f"🔐 Connecting to {args.url}...")
    gc = GirderClient(apiUrl=args.url)

    try:
        if args.token:
            print("   Authenticating with API token...")
            gc.setToken(args.token)
            # Test the token
            gc.get("user/me")
        elif args.username and args.password:
            print(f"   Authenticating as {args.username}...")
            gc.authenticate(username=args.username, password=args.password)
        else:
            print("   No credentials provided, using interactive authentication...")
            gc.authenticate(interactive=True)

        print("✅ Authentication successful")
    except Exception as e:
        print(f"❌ Authentication failed: {e}", file=sys.stderr)
        sys.exit(1)

    # Process items in batches (fetch and reset simultaneously)
    print(f"\n🔄 Processing items in batches of {args.page_size}...")
    print(f"⚠️  WARNING: This will clear all BDSA metadata from items!")

    response = input("Continue? (yes/no): ")
    if response.lower() not in ["yes", "y"]:
        print("❌ Cancelled by user")
        sys.exit(0)

    total_items = 0
    total_with_bdsa = 0
    total_without_bdsa = 0
    success_count = 0
    error_count = 0
    errors = []
    offset = 0
    page_num = 0

    while True:
        page_num += 1
        print(f"\n📄 Fetching page {page_num} (offset {offset})...")

        try:
            # Fetch one batch
            url = f"resource/{args.resource_id}/items"
            params = {
                "type": args.resource_type,
                "limit": args.page_size,
                "offset": offset,
            }
            print(f"   Making API call to: {url}")
            print(f"   Params: {params}")

            items = gc.get(url, parameters=params)

            if not items:
                print(f"   No more items found, stopping pagination")
                break

            print(f"   📊 Retrieved {len(items)} items")

            # Process this batch
            batch_with_bdsa = []
            batch_without_bdsa = []

            for item in items:
                meta = item.get("meta", {})
                bdsa = meta.get("BDSA")
                if bdsa and isinstance(bdsa, dict) and len(bdsa) > 0:
                    batch_with_bdsa.append(item)
                else:
                    batch_without_bdsa.append(item)

            print(
                f"   📊 Batch: {len(batch_with_bdsa)} with BDSA, {len(batch_without_bdsa)} without"
            )

            # Show sample for first batch
            if page_num == 1 and batch_with_bdsa:
                sample_item = batch_with_bdsa[0]
                sample_meta = sample_item.get("meta", {})
                sample_bdsa = sample_meta.get("BDSA", {})
                print(f"\n🔍 Sample BDSA metadata structure:")
                print(
                    f"   Item: {sample_item.get('name', 'Unknown')} ({sample_item.get('_id', 'Unknown')})"
                )
                print(f"   BDSA keys: {list(sample_bdsa.keys())}")

            # Reset BDSA metadata for items in this batch
            if batch_with_bdsa:
                print(
                    f"   🔄 Resetting BDSA metadata for {len(batch_with_bdsa)} items in this batch..."
                )

                for i, item in enumerate(batch_with_bdsa, 1):
                    item_id = item.get("_id")
                    item_name = item.get("name", "Unknown")

                    result = fix_item_bdsa_metadata(gc, item_id, item_name)

                    if result["success"]:
                        success_count += 1
                        if i % 10 == 0 or i == len(batch_with_bdsa):
                            print(
                                f"      ✅ Batch progress: {i}/{len(batch_with_bdsa)} items processed"
                            )
                    else:
                        error_count += 1
                        error_msg = f"Item {item_name} ({item_id}): {result['error']}"
                        errors.append(error_msg)
                        print(f"      ❌ Error: {error_msg}")

            # Update totals
            total_items += len(items)
            total_with_bdsa += len(batch_with_bdsa)
            total_without_bdsa += len(batch_without_bdsa)

            print(
                f"   📊 Batch complete. Total processed: {total_items} items, {total_with_bdsa} with BDSA, {success_count} reset successfully"
            )

            # If we got fewer items than page_size, we're done
            if len(items) < args.page_size:
                print(
                    f"   Got fewer items than page size ({len(items)} < {args.page_size}), stopping pagination"
                )
                break

            offset += args.page_size

        except Exception as e:
            print(f"❌ Error processing page {page_num}: {e}", file=sys.stderr)
            break

    if total_items == 0:
        print("⚠️  No items found in the resource")
        sys.exit(0)

    if total_with_bdsa == 0:
        print("\n✅ No items have BDSA metadata - nothing to reset!")
        sys.exit(0)

    # Note: Dry run mode is not supported in batch processing mode
    # since we process items as we fetch them

    # Summary
    print(f"\n{'='*60}")
    print(f"📊 SUMMARY")
    print(f"{'='*60}")
    print(f"Total items in resource: {total_items}")
    print(f"Items with BDSA metadata: {total_with_bdsa}")
    print(f"Items without BDSA metadata (skipped): {total_without_bdsa}")
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
