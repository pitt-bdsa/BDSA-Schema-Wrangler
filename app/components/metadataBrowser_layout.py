from dash import html, callback, Input, Output, no_update, State, dcc, ctx, ALL
import pandas as pd
import dash_ag_grid
import dash_bootstrap_components as dbc

from utils import get_csv_files
import json
from jsonschema import Draft7Validator
from collections import Counter
from components.summary_tables import stats_tab
import base64, io
import os


# Grab the CSV file data - NOTE: this may switch to a upload button later.
csv_file_data = get_csv_files("metadata")


def _get_column_defs(cols, existing_defs=None):
    """Read the shim dictionary and create column definitions."""
    with open("schemaFiles/adrcNpSchema.json", "r") as fh:
        schema = json.load(fh)

    # Create a dictionary of existing column definitions for quick lookup
    existing_dict = {}
    if existing_defs:
        existing_dict = {col_def["field"]: col_def for col_def in existing_defs}

    columnDefs = []

    for col in cols:
        # Start with existing column definition if available
        if col in existing_dict:
            col_def = existing_dict[col].copy()
        else:
            col_def = {"field": col}

        # Apply special formatting for specific columns
        if col in ["stainID", "regionName"]:
            values = schema["properties"][col]["enum"]
            values = [f'"{v}"' for v in values]

            col_def.update(
                {
                    "editable": True,
                    "cellStyle": {
                        "styleConditions": [
                            {
                                "condition": f"[{','.join(values)}].includes(params.value)",
                                "style": {"backgroundColor": "#A7FF9D"},
                            },
                        ],
                        "defaultStyle": {"backgroundColor": "#FFB3B3"},
                    },
                }
            )
        elif col == "caseID":
            col_def.update(
                {
                    "editable": True,
                    "cellStyle": {
                        "styleConditions": [
                            {
                                "condition": 'params.value != ""',
                                "style": {"backgroundColor": "#A7FF9D"},
                            },
                        ],
                        "defaultStyle": {"backgroundColor": "#FFB3B3"},
                    },
                }
            )

        columnDefs.append(col_def)

    return columnDefs


# Tables.
metadata_table = dash_ag_grid.AgGrid(
    id="metadata-table",
    className="ag-theme-alpine color-fonts compact",
    columnDefs=[],  # _get_column_defs(),
    dashGridOptions={
        "pagination": True,
        "paginationAutoPageSize": True,
        "rowSelection": "single",
    },
    rowData=[],
)

csv_select_data = [
    {
        "value": dct["fileName"],
        "label": f"{dct['fileName']} (rows = {dct['fileLength']})",
    }
    for dct in csv_file_data
]

# Replace the column visibility dropdown with a button that opens a modal
column_visibility_button = html.Div(
    [
        dbc.Button(
            "Show/Hide Columns",
            id="open-column-modal-button",
            color="primary",
            className="me-1",
        ),
        dbc.Modal(
            [
                dbc.ModalHeader("Manage Columns"),
                dbc.ModalBody(
                    [
                        dbc.Row(
                            [
                                dbc.Col(
                                    [
                                        dbc.Button(
                                            "Select All",
                                            id="select-all-columns-btn",
                                            color="primary",
                                            size="sm",
                                            className="me-2 mb-3",
                                        ),
                                        dbc.Button(
                                            "Deselect All",
                                            id="deselect-all-columns-btn",
                                            color="secondary",
                                            size="sm",
                                            className="me-2 mb-3",
                                        ),
                                        dbc.Button(
                                            "Reset to Default",
                                            id="reset-columns-btn",
                                            color="info",
                                            size="sm",
                                            className="mb-3",
                                        ),
                                    ],
                                    width=12,
                                ),
                            ]
                        ),
                        dbc.Row(
                            [
                                dbc.Col(
                                    [
                                        dbc.Checklist(
                                            id="column-visibility-checklist",
                                            options=[],
                                            value=[],
                                            style={
                                                "maxHeight": "400px",
                                                "overflowY": "auto",
                                            },
                                        ),
                                    ]
                                ),
                            ]
                        ),
                    ]
                ),
                dbc.ModalFooter(
                    dbc.Button(
                        "Close", id="close-column-modal-button", className="ms-auto"
                    )
                ),
            ],
            id="column-visibility-modal",
            size="lg",
            is_open=False,
        ),
    ],
    style={"display": "inline-block", "margin-right": "10px"},
)

# Add the column mapping button
column_mapping_button = html.Div(
    [
        dbc.Button(
            "Map Columns to Schema",
            id="open-mapping-modal-button",
            color="warning",
            className="me-1",
        ),
        dbc.Modal(
            [
                dbc.ModalHeader("Map Columns to Schema Fields"),
                dbc.ModalBody(
                    [
                        html.P(
                            "Select which columns in your data correspond to schema fields:",
                            className="mb-3",
                        ),
                        html.Div(id="column-mapping-container"),
                        dbc.Button(
                            "Apply Mappings",
                            id="apply-mappings-btn",
                            color="success",
                            className="mt-3",
                        ),
                    ]
                ),
                dbc.ModalFooter(
                    dbc.Button(
                        "Close", id="close-mapping-modal-button", className="ms-auto"
                    )
                ),
            ],
            id="column-mapping-modal",
            size="lg",
            is_open=False,
        ),
    ],
    style={"display": "inline-block", "margin-right": "10px"},
)

# Add the download component to the layout
metadataBrowser_tab = html.Div(
    [
        dcc.Download(id="download-dataframe-csv"),
        html.Div(
            [
                dcc.Upload(
                    dbc.Button(
                        "Upload Metadata File (.csv or .xlsx)",
                        color="info",
                        className="me-1",
                        style={"fontWeight": "bold"},
                    ),
                    id="upload-data",
                    style={
                        "width": "auto",
                        "height": "auto",
                        "lineHeight": "auto",
                        "borderWidth": "1px",
                        "textAlign": "center",
                        "margin-right": 5,
                    },
                ),
                dbc.Button(
                    "Apply Shim Dictionary",
                    id="shim-dict-btn",
                    color="warning",
                    className="me-1",
                ),
                dbc.Button(
                    "Export CSV",
                    id="export-btn",
                    color="success",
                    className="me-1",
                ),
                dbc.Button(
                    "Load Sample Data",
                    id="load_sample_data",
                    color="info",
                    className="me-1",
                ),
                column_mapping_button,
                column_visibility_button,
                html.Div(
                    "Showing metadata for files for:",
                    style={"fontWeight": "bold"},
                ),
                dcc.RadioItems(
                    id="filter-radio",
                    options=[
                        {"label": "All CSV", "value": "all-rows"},
                        {"label": "Only in file system", "value": "filtered-rows"},
                    ],
                    value="all-rows",
                    inline=True,
                    style={"margin-left": 10},
                    labelStyle={"margin-right": 10},
                ),
            ],
            style={"display": "flex", "padding": "5px", "align-items": "center"},
        ),
        html.Div(
            children=[
                metadata_table,
                dbc.Collapse(
                    stats_tab, id="collapse", is_open=False, style={"width": "50%"}
                ),
                dbc.Button(
                    "Stats",
                    id="stats-btn",
                    color="primary",
                    className="me-1",
                    style={"height": "auto"},
                ),
            ],
            style={"display": "flex"},
        ),
    ],
)


@callback(
    Output("metadata-store", "data"),
    [
        Input("upload-data", "contents"),
        Input("upload-data", "filename"),
        Input("shim-dict-btn", "n_clicks"),
        Input("load_sample_data", "n_clicks"),
    ],
    State("metadata-store", "data"),
    prevent_initial_call=True,
)
def update_metadata_store(
    contents, filename, apply_shim_button, load_sample_data_button, current_store
):
    """Update the metadata store from selected CSV file."""
    context_id = ctx.triggered_id

    if apply_shim_button and context_id == "shim-dict-btn" and current_store:
        # Apply the shim dictionary to the entire store and reload!
        with open("shim-dictionary.json", "r") as fh:
            shim_dict = json.load(fh)

        df = pd.DataFrame(current_store).fillna("")

        for i, r in df.iterrows():
            for metadata_key, key_map in shim_dict.items():
                # Check if the row has this key.
                row_value = r.get(metadata_key, "")

                if row_value not in key_map:
                    for k, v in key_map.items():
                        if row_value in v:
                            df.loc[i, metadata_key] = k
                            break

        return df.to_dict("records")
    elif load_sample_data_button and context_id == "load_sample_data":
        # Load the sample data with more careful parsing-- using year 2020 right now
        try:
            # Try reading with explicit parameters to handle special characters in column names
            df = pd.read_csv("year_2020_dsametadata.csv", encoding="utf-8")
            print("Sample data loaded. Columns:", df.columns.tolist())

            # Normalize column names to ensure consistency
            # This renames columns to a standard format (lowercase, spaces to underscores)
            df.columns = [
                col.lower().replace(" ", "_").replace(".", "_") for col in df.columns
            ]

            # If you need to specifically rename a column to 'fileName'
            if "filename" in df.columns:
                df = df.rename(columns={"filename": "fileName"})
            elif "file_name" in df.columns:
                df = df.rename(columns={"file_name": "fileName"})

            print("Normalized columns:", df.columns.tolist())
            return df.to_dict("records")
        except Exception as e:
            print(f"Error loading sample data: {e}")
            print(f"Current working directory: {os.getcwd()}")
            return []
    elif contents is not None and context_id == "upload-data":
        # There should be a single file.
        content_type, content_string = contents.split(",")
        decoded = base64.b64decode(content_string)
        df = pd.read_csv(io.StringIO(decoded.decode("utf-8")))

        return df.to_dict("records")

    return []


@callback(
    Output("column-visibility-store", "data"),
    Input("column-visibility-checklist", "value"),
    State("column-visibility-checklist", "options"),
    State("column-visibility-store", "data"),
    prevent_initial_call=True,
)
def update_column_visibility(selected_columns, options, current_visibility):
    """Update the column visibility store based on user selection."""
    if not options:
        return current_visibility or {}

    all_columns = [option["value"] for option in options]

    # Start with existing visibility settings
    visibility = current_visibility.copy() if current_visibility else {}

    # Update visibility based on selection
    for col in all_columns:
        visibility[col] = col in selected_columns

    # Always make standardized columns visible
    for col in ["bdsaCaseID", "bdsaRegionID", "bdsaStainID"]:
        if col in all_columns:
            visibility[col] = True

    return visibility


@callback(
    Output("column-visibility-checklist", "options"),
    Output("column-visibility-checklist", "value"),
    Input("metadata-store", "data"),
    State("column-visibility-store", "data"),
    prevent_initial_call=True,
)
def update_column_checklist(metadata_data, stored_visibility):
    """Update the column visibility checklist based on available columns."""
    if not metadata_data:
        return [], []

    # Get all column fields from the data
    df = pd.DataFrame(metadata_data)
    all_columns = df.columns.tolist()

    # Create options for the checklist
    options = [{"label": col, "value": col} for col in all_columns]

    # Determine which columns should be visible
    if stored_visibility:
        # For existing columns, use stored visibility
        # For new columns, default to visible
        visible_columns = [
            col for col in all_columns if stored_visibility.get(col, True)
        ]
    else:
        # Default: all columns visible
        visible_columns = all_columns

    return options, visible_columns


@callback(
    Output("metadata-table", "columnDefs"),
    [
        Input("metadata-store", "data"),
        Input("filter-radio", "value"),
        Input("column-visibility-store", "data"),
    ],
    [State("localFileSet_store", "data"), State("metadata-table", "columnDefs")],
    prevent_initial_call=True,
)
def update_table_columns(
    metadata_data: list[dict],
    showing: str,
    visibility: dict,
    local_fileset_store: list[dict],
    existing_column_defs: list,
):
    """Update the table columns based on data changes and visibility settings."""
    trigger = ctx.triggered_id

    if trigger == "column-visibility-store" and existing_column_defs:
        # Only visibility changed, apply it to existing columns
        if not visibility:
            return existing_column_defs

        updated_column_defs = []
        for col_def in existing_column_defs:
            field = col_def["field"]
            new_col_def = col_def.copy()

            # Always show standardized columns
            if field in ["bdsaCaseID", "bdsaRegionID", "bdsaStainID"]:
                new_col_def["hide"] = False
            else:
                new_col_def["hide"] = not visibility.get(field, True)

            updated_column_defs.append(new_col_def)

        return updated_column_defs

    elif metadata_data:
        # Data changed, create new column definitions
        df = pd.DataFrame(metadata_data).fillna("")

        # Ensure standardized columns exist
        for col in ["bdsaCaseID", "bdsaRegionID", "bdsaStainID"]:
            if col not in df.columns:
                df[col] = ""

        # Reorder columns to put standardized columns first
        cols = df.columns.tolist()
        for col in ["bdsaCaseID", "bdsaRegionID", "bdsaStainID"]:
            if col in cols:
                cols.remove(col)

        df = df[["bdsaCaseID", "bdsaRegionID", "bdsaStainID"] + cols]

        # Create column definitions
        columnDefs = _get_column_defs(df.columns, existing_column_defs)

        # Apply visibility settings if available
        if visibility:
            for col_def in columnDefs:
                field = col_def["field"]

                # Always show standardized columns
                if field in ["bdsaCaseID", "bdsaRegionID", "bdsaStainID"]:
                    col_def["hide"] = False
                else:
                    # For existing columns, use stored visibility
                    # For new columns, default to visible
                    col_def["hide"] = not visibility.get(field, True)

        # Ensure standardized columns are pinned to the left
        for col_def in columnDefs:
            if col_def["field"] in ["bdsaCaseID", "bdsaRegionID", "bdsaStainID"]:
                col_def["pinned"] = "left"

        return columnDefs

    return []


@callback(
    Output("metadata-table", "rowData"),
    [Input("metadata-store", "data"), Input("filter-radio", "value")],
    [State("localFileSet_store", "data")],
    prevent_initial_call=True,
)
def update_metadata_table_rows(
    metadata_data: list[dict], showing: str, local_fileset_store: list[dict]
) -> list[dict]:
    """Update just the row data when the metadata store changes or the filter changes."""
    if metadata_data:
        # Return the metadata directly from store, or filter it by matching to local fileset.
        df = pd.DataFrame(metadata_data).fillna("")

        if showing != "all-rows":
            local_fns = [
                file_data.get("fileName", "") for file_data in local_fileset_store
            ]

            # Check for possible filename column variations
            filename_col = None
            for possible_name in [
                "fileName",
                "FileName",
                "filename",
                "file_name",
                "file name",
            ]:
                if possible_name in df.columns:
                    filename_col = possible_name
                    break

            # If we found a filename column, filter by it
            if filename_col:
                df = df[df[filename_col].isin(local_fns)]
            else:
                print(
                    "Warning: No filename column found in metadata. Available columns:",
                    df.columns.tolist(),
                )

            return df.to_dict("records")

        return metadata_data

    return []


@callback(
    Output("collapse", "is_open"),
    Input("stats-btn", "n_clicks"),
    State("collapse", "is_open"),
    prevent_initial_call=True,
)
def toggle_collapse(n_clicks: int, is_open: bool) -> bool:
    if n_clicks:
        return not is_open

    return is_open


@callback(
    [
        Output("stats-summary-table", "rowData"),
        Output("stats-stains-table", "rowData"),
        Output("stats-regions-table", "rowData"),
    ],
    [
        Input("metadata-table", "rowData"),
        Input("metadata-table", "cellValueChanged"),
        Input("stains-switch", "checked"),
        Input("regions-switch", "checked"),
    ],
    [
        State("column-mapping-store", "data"),
    ],
    prevent_initial_call=True,
)
def get_metadata_stats(
    table_data: list[dict],
    _: dict,
    stain_check: bool,
    region_check: bool,
    column_mappings: dict,
):
    """Get the metadata stats to populate the summary tables."""
    if len(table_data):
        # Read the schema.
        with open("schemaFiles/adrcNpSchema.json", "r") as fh:
            schema = json.load(fh)

        valid_regions = schema["properties"]["regionName"]["enum"]
        valid_stains = schema["properties"]["stainID"]["enum"]

        # Convert to dataframe for faster searching.
        table_data = pd.DataFrame(table_data).fillna("")

        # Initialize counters and stats
        stains = Counter()
        regions = Counter()

        # Get mapped column names
        stain_col = column_mappings.get("stainID")
        region_col = column_mappings.get("regionName")
        case_col = column_mappings.get("caseID")

        # Use standardized columns if they exist
        if "bdsaStainID" in table_data.columns:
            stain_col = "bdsaStainID"
        elif not stain_col:
            for col in ["stainID", "stain_id", "stain", "Stain"]:
                if col in table_data.columns:
                    stain_col = col
                    break

        if "bdsaRegionID" in table_data.columns:
            region_col = "bdsaRegionID"
        elif not region_col:
            for col in ["regionName", "region_name", "region", "Region"]:
                if col in table_data.columns:
                    region_col = col
                    break

        if "bdsaCaseID" in table_data.columns:
            case_col = "bdsaCaseID"
        elif not case_col:
            for col in ["caseID", "case_id", "case", "Case"]:
                if col in table_data.columns:
                    case_col = col
                    break

        # Calculate stain stats
        stain_valid_count = 0
        if stain_col and stain_col in table_data.columns:
            # Count valid stains
            stain_valid_count = len(
                table_data[table_data[stain_col].isin(valid_stains)]
            )

            # Count stain frequencies
            if stain_check:
                stain_counts = table_data[stain_col].value_counts().to_dict()
                stains.update(stain_counts)

        # Calculate region stats
        region_valid_count = 0
        if region_col and region_col in table_data.columns:
            # Count valid regions
            region_valid_count = len(
                table_data[table_data[region_col].isin(valid_regions)]
            )

            # Count region frequencies
            if region_check:
                region_counts = table_data[region_col].value_counts().to_dict()
                regions.update(region_counts)

        # Calculate file validity
        valid_files = 0
        if (
            stain_col
            and region_col
            and stain_col in table_data.columns
            and region_col in table_data.columns
        ):
            valid_files = len(
                table_data[
                    table_data[stain_col].isin(valid_stains)
                    & table_data[region_col].isin(valid_regions)
                ]
            )

        # Calculate case valid count
        case_valid_count = 0
        if case_col and case_col in table_data.columns:
            case_valid_count = len(table_data[table_data[case_col] != ""])

        N = len(table_data)

        # Create stats dataframe with proper percentage formatting
        stats_rows = []

        # Format percentages properly
        if N > 0:
            files_pct = f"{valid_files} ({valid_files/N*100:.2f}%)"
            case_pct = (
                f"{case_valid_count} ({case_valid_count/N*100:.2f}%)"
                if case_col and case_col in table_data.columns
                else "Column not found or not mapped"
            )
            stain_pct = (
                f"{stain_valid_count} ({stain_valid_count/N*100:.2f}%)"
                if stain_col and stain_col in table_data.columns
                else "Column not found or not mapped"
            )
            region_pct = (
                f"{region_valid_count} ({region_valid_count/N*100:.2f}%)"
                if region_col and region_col in table_data.columns
                else "Column not found or not mapped"
            )
        else:
            files_pct = "0 (0.00%)"
            case_pct = (
                "0 (0.00%)"
                if case_col and case_col in table_data.columns
                else "Column not found or not mapped"
            )
            stain_pct = (
                "0 (0.00%)"
                if stain_col and stain_col in table_data.columns
                else "Column not found or not mapped"
            )
            region_pct = (
                "0 (0.00%)"
                if region_col and region_col in table_data.columns
                else "Column not found or not mapped"
            )

        stats_rows.append(["Files", files_pct])

        if case_col and case_col in table_data.columns:
            stats_rows.append(["caseID", case_pct])
            stats_rows.append(["caseID column", case_col])
        else:
            stats_rows.append(["caseID", "Column not found or not mapped"])

        if stain_col and stain_col in table_data.columns:
            stats_rows.append(["stainID", stain_pct])
            stats_rows.append(["stainID column", stain_col])
        else:
            stats_rows.append(["stainID", "Column not found or not mapped"])

        if region_col and region_col in table_data.columns:
            stats_rows.append(["regionName", region_pct])
            stats_rows.append(["regionName column", region_col])
        else:
            stats_rows.append(["regionName", "Column not found or not mapped"])

        stats_df = pd.DataFrame(stats_rows, columns=["Field", "Validated"])

        # Populate the stain and region tables.
        stain_df = pd.DataFrame(stains.items(), columns=["Stain", "Count"])
        region_df = pd.DataFrame(regions.items(), columns=["Region", "Count"])

        return (
            stats_df.to_dict("records"),
            stain_df.to_dict("records"),
            region_df.to_dict("records"),
        )

    return [], [], []


@callback(
    Output("column-visibility-checklist", "value", allow_duplicate=True),
    Input("select-all-columns-btn", "n_clicks"),
    State("column-visibility-checklist", "options"),
    prevent_initial_call=True,
)
def select_all_columns(n_clicks, options):
    """Select all columns."""
    if not options:
        return []
    return [option["value"] for option in options]


@callback(
    Output("column-visibility-checklist", "value", allow_duplicate=True),
    Input("deselect-all-columns-btn", "n_clicks"),
    prevent_initial_call=True,
)
def deselect_all_columns(n_clicks):
    """Deselect all columns."""
    return []


@callback(
    Output("column-visibility-modal", "is_open"),
    [
        Input("open-column-modal-button", "n_clicks"),
        Input("close-column-modal-button", "n_clicks"),
    ],
    [State("column-visibility-modal", "is_open")],
    prevent_initial_call=True,
)
def toggle_column_modal(open_clicks, close_clicks, is_open):
    """Toggle the column visibility modal."""
    if open_clicks or close_clicks:
        return not is_open
    return is_open


@callback(
    Output("column-mapping-modal", "is_open"),
    [
        Input("open-mapping-modal-button", "n_clicks"),
        Input("close-mapping-modal-button", "n_clicks"),
        Input("apply-mappings-btn", "n_clicks"),
    ],
    [State("column-mapping-modal", "is_open")],
    prevent_initial_call=True,
)
def toggle_mapping_modal(open_clicks, close_clicks, apply_clicks, is_open):
    """Toggle the column mapping modal."""
    if open_clicks or close_clicks or apply_clicks:
        return not is_open
    return is_open


@callback(
    Output("column-mapping-container", "children"),
    Input("open-mapping-modal-button", "n_clicks"),
    [
        State("metadata-store", "data"),
        State("column-mapping-store", "data"),
    ],
    prevent_initial_call=True,
)
def populate_mapping_form(n_clicks, metadata_data, stored_mappings):
    """Populate the column mapping form with schema fields and data columns."""
    if not metadata_data:
        return html.Div("No data loaded. Please load data first.")

    # Load schema
    try:
        with open("schemaFiles/adrcNpSchema.json", "r") as f:
            schema = json.load(f)

        # Get schema fields (top-level properties)
        schema_fields = list(schema.get("properties", {}).keys())

        # Get data columns
        df = pd.DataFrame(metadata_data)
        data_columns = df.columns.tolist()

        # Create dropdown options for data columns
        column_options = [{"label": col, "value": col} for col in data_columns]
        column_options.insert(0, {"label": "-- Not Mapped --", "value": ""})

        # Create a mapping form for each schema field
        mapping_form = []
        for field in schema_fields:
            # Get current mapping if it exists
            current_value = stored_mappings.get(field, "")

            mapping_form.append(
                dbc.Row(
                    [
                        dbc.Col(html.Label(field), width=4),
                        dbc.Col(
                            dbc.Select(
                                id={"type": "schema-field-mapping", "field": field},
                                options=column_options,
                                value=current_value,
                            ),
                            width=8,
                        ),
                    ],
                    className="mb-2",
                )
            )

        return html.Div(mapping_form)

    except Exception as e:
        return html.Div(f"Error loading schema: {str(e)}")


@callback(
    Output("column-mapping-store", "data"),
    Input("apply-mappings-btn", "n_clicks"),
    [
        State({"type": "schema-field-mapping", "field": ALL}, "value"),
        State({"type": "schema-field-mapping", "field": ALL}, "id"),
        State("column-mapping-store", "data"),
    ],
    prevent_initial_call=True,
)
def update_column_mappings(n_clicks, values, ids, current_mappings):
    """Update the column mappings based on user selection."""
    if not n_clicks:
        return current_mappings

    # Start with existing mappings
    mappings = current_mappings.copy() if current_mappings else {}

    # Update mappings based on form values
    for i, id_obj in enumerate(ids):
        field = id_obj["field"]
        value = values[i]

        # Only store non-empty mappings
        if value:
            mappings[field] = value
        elif field in mappings:
            # Remove mapping if set to empty
            del mappings[field]

    return mappings


@callback(
    Output("metadata-store", "data", allow_duplicate=True),
    Input("apply-mappings-btn", "n_clicks"),
    [
        State("metadata-store", "data"),
        State("column-mapping-store", "data"),
    ],
    prevent_initial_call=True,
)
def apply_column_mappings(n_clicks, metadata_data, mappings):
    """Apply column mappings to the metadata and add standardized columns."""
    if not n_clicks or not metadata_data or not mappings:
        return metadata_data

    # Convert to DataFrame for easier manipulation
    df = pd.DataFrame(metadata_data)

    # Create standardized columns
    # First, check if the mapped columns exist
    stain_col = mappings.get("stainID")
    region_col = mappings.get("regionName")
    case_col = mappings.get("caseID")

    # Create the standardized columns
    if stain_col and stain_col in df.columns:
        df["bdsaStainID"] = df[stain_col]
    else:
        df["bdsaStainID"] = ""

    if region_col and region_col in df.columns:
        df["bdsaRegionID"] = df[region_col]
    else:
        df["bdsaRegionID"] = ""

    if case_col and case_col in df.columns:
        df["bdsaCaseID"] = df[case_col]
    else:
        df["bdsaCaseID"] = ""

    # Reorder columns to put standardized columns first
    cols = df.columns.tolist()
    for col in ["bdsaCaseID", "bdsaRegionID", "bdsaStainID"]:
        if col in cols:
            cols.remove(col)

    # Put standardized columns first
    new_cols = ["bdsaCaseID", "bdsaRegionID", "bdsaStainID"] + cols
    df = df[new_cols]

    return df.to_dict("records")


@callback(
    Output("download-dataframe-csv", "data"),
    Input("export-btn", "n_clicks"),
    State("metadata-table", "rowData"),
    prevent_initial_call=True,
)
def export_csv(n_clicks, table_data):
    """Export the metadata table to a CSV file."""
    if n_clicks and table_data:
        df = pd.DataFrame(table_data)

        # Ensure standardized columns are first
        cols = df.columns.tolist()
        std_cols = ["bdsaCaseID", "bdsaRegionID", "bdsaStainID"]
        for col in std_cols:
            if col in cols:
                cols.remove(col)

        # Reorder columns
        if any(col in df.columns for col in std_cols):
            present_std_cols = [col for col in std_cols if col in df.columns]
            df = df[present_std_cols + cols]

        return dcc.send_data_frame(df.to_csv, "metadata_export.csv", index=False)

    return no_update


def add_standardized_columns(df, mappings):
    """Add standardized columns to the dataframe."""
    # Get mapped column names
    stain_col = mappings.get("stainID") if mappings else None
    region_col = mappings.get("regionName") if mappings else None
    case_col = mappings.get("caseID") if mappings else None

    # Create the standardized columns
    if stain_col and stain_col in df.columns:
        df["bdsaStainID"] = df[stain_col]
    else:
        df["bdsaStainID"] = ""

    if region_col and region_col in df.columns:
        df["bdsaRegionID"] = df[region_col]
    else:
        df["bdsaRegionID"] = ""

    if case_col and case_col in df.columns:
        df["bdsaCaseID"] = df[case_col]
    else:
        df["bdsaCaseID"] = ""

    # Reorder columns to put standardized columns first
    cols = df.columns.tolist()
    for col in ["bdsaCaseID", "bdsaRegionID", "bdsaStainID"]:
        if col in cols:
            cols.remove(col)

    # Put standardized columns first
    new_cols = ["bdsaCaseID", "bdsaRegionID", "bdsaStainID"] + cols
    df = df[new_cols]

    return df
