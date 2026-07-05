# Proyecto Acme Producción (JavaScript)

## Descripción
Aplicación web (HTML + CSS + JavaScript) para gestionar:
- **Login**
- **CRUD de usuarios**
- **Inventario** (productos/materia prima y stock dinámico)
- **Producción** (procesos con resumen de insumos y generación de producto terminado)

> Nota: Este prototipo usa **localStorage** para persistir datos (sin backend).
 
## Requerimientos previos
- Navegador moderno (Chrome/Edge/Firefox)
- Tener la carpeta del proyecto en tu equipo

## Instalación y ejecución
1. Clona o copia el proyecto.
2. Ejecuta abriendo el archivo principal:

```bash
open index.html
```

En Windows puedes abrir directamente **`index.html`** con doble clic.

## Funcionalidades principales
- **Login seguro (demo)** con validación de credenciales.
- **CRUD de usuarios**: crear / editar / eliminar. Doble validación de contraseña.
- **Inventario** con **buscador** y actualización de stock (crear producto + ingresar stock).
- **Producción automatizada**:
  - Selección de producto a fabricar.
  - Cantidad a producir.
  - Resumen: materia prima consumida y producto terminado.
  - Código de proceso consecutivo automático.

## Estructura técnica
- `index.html` → contenedor principal y navegación.
- `styles.css` → estilos generales y responsive.
- `app.js` → punto de entrada que renderiza módulos.
- `modules/`
  - `login.js`
  - `users.js`
  - `inventory.js`
  - `production.js`
  - `utils.js`

## Buenas prácticas aplicadas
- **Modularización** en JavaScript (módulos por dominio).
- Uso de **funciones utilitarias** compartidas (`utils.js`).
- **Validaciones en formularios**.
- Diseño **responsive** (grid + flex).

## Credenciales demo
- Identificación: `123`
- Contraseña: `admin`

## Formato de fórmula (inventario)
Para un producto a fabricar, define su fórmula opcional así:
- `INS1:2; INS2:3`

Donde:
- `INS1`, `INS2` = códigos de insumos existentes.
- `2`, `3` = cantidades por unidad del producto terminado.

