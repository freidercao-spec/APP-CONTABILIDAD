Puede ser que el servidor aún no esté en marcha o que el puerto esté bloqueado. Intenta lo siguiente:

1. Asegúrate de estar en la raíz del proyecto (`coraza-cta-app`).
2. Ejecuta `npm install` para instalar dependencias.
3. Luego `npm start`. Si el puerto 3000 ya está en uso, cambia el puerto en la variables de entorno: `PORT=4000 npm start`.

Si ves `ERR_CONNECTION_REFUSED`, verifica que no haya un firewall bloqueando el puerto.
