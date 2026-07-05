# Proyecto Acme Producción (JavaScript + Firebase)

## Descripción
Aplicación web (HTML + CSS + JavaScript) para gestionar:

- **Login**
- **CRUD de usuarios**
- **Inventario** (productos/materia prima y stock dinámico)
- **Producción** (procesos con resumen de insumos y generación de producto terminado)

La persistencia de datos se realiza en **Firebase Firestore** mediante un documento único.

## Requerimientos previos
- Navegador moderno (Chrome/Edge/Firefox)
- Tener la carpeta del proyecto en tu equipo
- Conexión a Internet (se cargan módulos Firebase desde CDN)

## Configuración Firebase
La conexión a Firebase está en `firebase.js` mediante el objeto `firebaseConfig`.

## Instalación y ejecución
1. Clona o copia el proyecto.
2. Abre `index.html` en el navegador.

En Windows:
- Puedes abrir `index.html` con doble clic, o
- Usar una extensión como **Live Server** en VS Code para desarrollo.

## Funcionalidades principales
- **Login seguro (demo)** con validación de credenciales.
- **CRUD de usuarios**: crear / editar / eliminar.
- **Inventario** con buscador y actualización de stock.
- **Producción automatizada**:
  - Selección de producto a fabricar.
  - Cantidad a producir.
  - Resumen de materia prima consumida y producto terminado.
  - Código de proceso consecutivo automático.


## Documentación técnica
### Ejecución del proyecto
1. Clona o copia el repositorio en tu equipo.
2. Verifica acceso a Internet (CDN de Firebase).
3. Revisa la configuración en `firebase.js`:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `appId`
4. Abre `index.html` en el navegador, o ejecuta con **Live Server** en VS Code.
5. Valida que la app cargue y que las operaciones persistan en Firestore.

### Descripción funcional por módulo
- `login.js`
  - Gestiona autenticación de acceso demo.
  - Controla validaciones básicas de credenciales.

- `users.js`
  - Implementa alta, edición y eliminación de usuarios.
  - Aplica validaciones de integridad de datos.

- `inventory.js`
  - Administra catálogo de productos/insumos.
  - Permite actualización de stock y búsqueda.

- `production.js`
  - Ejecuta procesos de fabricación.
  - Calcula consumo de insumos según fórmula.
  - Registra resultado de producto terminado y resumen de operación.

- `firestoreStore.js`
  - Encapsula acceso a Firestore (`get/set`).
  - Centraliza persistencia en colección/documento principal.

- `firestoreUtils.js`
  - Contiene utilidades transversales (IDs, validación, sanitización y helpers).

## Estructura técnica
- `index.html` → contenedor principal y navegación.
- `styles.css` → estilos generales y responsive.
- `app.js` → punto de entrada y renderizado de módulos.
- `firebase.js` → inicialización de Firebase y export de `db`.
- `modules/`
  - `login.js`
  - `users.js`
  - `inventory.js`
  - `production.js`
  - `utils.js`
  - `firestoreStore.js` → acceso a Firestore (`get/set` por clave).
  - `firestoreUtils.js` → utilidades compartidas + storage adaptado a Firestore.

## Persistencia de datos
Los datos se guardan en Firestore en:
- Colección: `acme_data`
- Documento: `data`

Desde `modules/firestoreStore.js` se maneja lectura/escritura centralizada del documento.

## Buenas prácticas aplicadas
- **Modularización** en JavaScript (módulos por dominio).
- **Separación de infraestructura** (Firebase/Firestore) y lógica funcional.
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

