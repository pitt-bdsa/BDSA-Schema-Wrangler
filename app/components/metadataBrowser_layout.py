from dash import html, callback, Input, Output, no_update, State, dcc, ctx
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

metadataBrowser_tab = html.Div(
    [
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
            new_col_def["hide"] = not visibility.get(field, True)
            updated_column_defs.append(new_col_def)

        return updated_column_defs

    elif metadata_data:
        # Data changed, create new column definitions
        df = pd.DataFrame(metadata_data).fillna("")
        columnDefs = _get_column_defs(df.columns, existing_column_defs)

        # Apply visibility settings if available
        if visibility:
            for col_def in columnDefs:
                field = col_def["field"]
                # For existing columns, use stored visibility
                # For new columns, default to visible
                col_def["hide"] = not visibility.get(field, True)

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
    prevent_initial_call=True,
)
def get_metadata_stats(
    table_data: list[dict], _: dict, stain_check: bool, region_check: bool
):
    """Get the metadata stats to populate the summary tables.

    Args:
        table_data (list[dict]): The metadata table data.
        _ (dict): The cellValueChanged event data.
        stain_check (bool): The stain switch state.
        region_check (bool): The region switch state.

    Returns:

    """
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

        # Check for stainID column (might be lowercase or have different naming)
        stain_col = None
        for possible_name in ["stainID", "stainid", "stain_id", "stain"]:
            if possible_name in table_data.columns:
                stain_col = possible_name
                break

        # Check for regionName column
        region_col = None
        for possible_name in ["regionName", "regionname", "region_name", "region"]:
            if possible_name in table_data.columns:
                region_col = possible_name
                break

        # Check for caseID column
        case_col = None
        for possible_name in ["caseID", "caseid", "case_id", "case"]:
            if possible_name in table_data.columns:
                case_col = possible_name
                break

        # Process stains if column exists
        if stain_col:
            if stain_check:
                # Get unmapped stains.
                df = table_data[~table_data[stain_col].isin(valid_stains)]
            else:
                df = table_data[table_data[stain_col].isin(valid_stains)]

            stains = Counter(df[stain_col].tolist())
            stain_valid_count = len(
                table_data[table_data[stain_col].isin(valid_stains)]
            )
        else:
            print("Warning: No stain column found in metadata")
            stain_valid_count = 0

        # Process regions if column exists
        if region_col:
            if region_check:
                # Get unmapped regions.
                df = table_data[~table_data[region_col].isin(valid_regions)]
            else:
                df = table_data[table_data[region_col].isin(valid_regions)]

            regions = Counter(df[region_col].tolist())
            region_valid_count = len(
                table_data[table_data[region_col].isin(valid_regions)]
            )
        else:
            print("Warning: No region column found in metadata")
            region_valid_count = 0

        # Calculate valid files count
        valid_files = 0
        if case_col and stain_col and region_col:
            valid_files = len(
                table_data[
                    (table_data[case_col] != "")
                    & (table_data[stain_col].isin(valid_stains))
                    & (table_data[region_col].isin(valid_regions))
                ]
            )

        # Calculate case valid count
        case_valid_count = 0
        if case_col:
            case_valid_count = len(table_data[table_data[case_col] != ""])

        N = len(table_data)

        # Create stats dataframe
        stats_rows = []
        stats_rows.append(
            ["Files", f"{valid_files} ({valid_files/N*100:.2f}% if N > 0 else 0)"]
        )

        if case_col:
            stats_rows.append(
                [
                    "caseID",
                    f"{case_valid_count} ({case_valid_count/N*100:.2f}% if N > 0 else 0)",
                ]
            )
        else:
            stats_rows.append(["caseID", "Column not found"])

        if stain_col:
            stats_rows.append(
                [
                    "stainID",
                    f"{stain_valid_count} ({stain_valid_count/N*100:.2f}% if N > 0 else 0)",
                ]
            )
        else:
            stats_rows.append(["stainID", "Column not found"])

        if region_col:
            stats_rows.append(
                [
                    "regionName",
                    f"{region_valid_count} ({region_valid_count/N*100:.2f}% if N > 0 else 0)",
                ]
            )
        else:
            stats_rows.append(["regionName", "Column not found"])

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
