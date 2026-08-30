import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DataTable, type DataTableColumn } from "./data-table"

interface Row {
  id: string
  name: string
  role: string
}

const rows: Row[] = [
  { id: "emp_1", name: "Laura Martinez", role: "Estilista" },
  { id: "emp_2", name: "Marc Oliva", role: "Barbero" },
  { id: "emp_3", name: "Sofia Prat", role: "Colorista" },
]

const columns: DataTableColumn<Row>[] = [
  { key: "name", header: "Empleado", width: "minmax(0,1.5fr)", cell: (row) => row.name },
  { key: "role", header: "Puesto", width: "170px", cell: (row) => row.role },
  { key: "chevron", header: "", width: "20px", cell: () => "›" },
]

describe("DataTable", () => {
  it("pinta un columnheader por columna, incluida la vacia que solo ocupa hueco", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} caption="Empleados" />)

    const headers = screen.getAllByRole("columnheader")
    expect(headers).toHaveLength(3)
    expect(headers[0]).toHaveTextContent("Empleado")
    expect(headers[1]).toHaveTextContent("Puesto")
    expect(headers[2]).toHaveTextContent("")
  })

  it("pinta una fila role=row por elemento, con una celda por columna", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} caption="Empleados" />)

    const [, ...dataRows] = screen.getAllByRole("row")
    expect(dataRows).toHaveLength(3)
    expect(screen.getAllByRole("cell")).toHaveLength(3 * columns.length)
  })

  it("con href, cada fila es un enlace alcanzable por teclado hacia la ruta correcta", async () => {
    const user = userEvent.setup()
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        href={(row) => `/staff/${row.id}`}
        caption="Empleados"
      />
    )

    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(3)
    expect(links[0]).toHaveAttribute("href", "/staff/emp_1")
    expect(links[1]).toHaveAttribute("href", "/staff/emp_2")

    await user.tab()
    expect(links[0]).toHaveFocus()
  })

  it("variant=nested aplica el alto y el fondo de D4 por clase, no por pixel", () => {
    const { rerender } = render(
      <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} caption="Empleados" />
    )
    const [screenHeaderRow] = screen.getAllByRole("row")
    expect(screenHeaderRow).toHaveClass("h-11")
    expect(screenHeaderRow).toHaveClass("bg-sidebar")

    rerender(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        variant="nested"
        caption="Historial de citas"
      />
    )
    const [nestedHeaderRow] = screen.getAllByRole("row")
    expect(nestedHeaderRow).toHaveClass("h-10")
    expect(nestedHeaderRow).toHaveClass("bg-muted-subtle")
  })

  it("rowClassName se aplica solo a la fila que la devuelve", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        rowClassName={(row) => (row.id === "emp_2" ? "bg-muted-subtle" : undefined)}
        caption="Empleados"
      />
    )

    const [, ...dataRows] = screen.getAllByRole("row")
    expect(dataRows[0]).not.toHaveClass("bg-muted-subtle")
    expect(dataRows[1]).toHaveClass("bg-muted-subtle")
    expect(dataRows[2]).not.toHaveClass("bg-muted-subtle")
  })

  it("el separador no aparece detras de la ultima fila cuando no hay footer", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} caption="Empleados" />)

    const table = screen.getByRole("table")
    const [, ...dataRows] = screen.getAllByRole("row")
    expect(table.lastElementChild).toBe(dataRows[dataRows.length - 1])
    expect(screen.getAllByTestId("data-table-separator")).toHaveLength(rows.length - 1)
  })

  it("el footer solo se monta si viene, y cuando viene se separa de la ultima fila", () => {
    const { rerender } = render(
      <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} caption="Historial de citas" />
    )
    expect(screen.queryByText("Mostrando 3 de 3 citas")).not.toBeInTheDocument()

    rerender(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        caption="Historial de citas"
        footer={<div>Mostrando 3 de 3 citas</div>}
      />
    )

    expect(screen.getByText("Mostrando 3 de 3 citas")).toBeInTheDocument()
    const table = screen.getByRole("table")
    expect(table.lastElementChild).toHaveTextContent("Mostrando 3 de 3 citas")
    // DetalleClienteDesktop.dc.html:218-224 dibuja un separador entre la
    // ultima fila y el footer: con footer hay tantos separadores como filas,
    // no filas-1.
    expect(screen.getAllByTestId("data-table-separator")).toHaveLength(rows.length)
  })
})
