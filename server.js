const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    },
    maxHttpBufferSize: 1024 * 1024
});


const uploadDirectory = path.join(
    __dirname,
    "uploads"
);


// إنشاء مجلد uploads لو مش موجود
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, {
        recursive: true
    });
}


app.use(express.static(
    path.join(__dirname, "public")
));


io.on("connection", (socket) => {

    console.log(
        "Client connected:",
        socket.id
    );


    // بداية رفع ملف
    socket.on("upload-start", (data) => {

        try {

            const {
                uploadId,
                fileName,
                fileSize,
                mimeType
            } = data;


            if (!uploadId || !fileName) {
                socket.emit("upload-error", {
                    message: "بيانات الملف غير صحيحة"
                });

                return;
            }


            // تنظيف اسم الملف
            const safeName = path.basename(
                fileName
            );


            const finalName =
                `${uploadId}-${safeName}`;


            const filePath = path.join(
                uploadDirectory,
                finalName
            );


            // إنشاء ملف جديد
            fs.writeFileSync(
                filePath,
                Buffer.alloc(0)
            );


            // حفظ بيانات الرفع داخل socket
            socket.uploads ??= {};


            socket.uploads[uploadId] = {
                fileName: safeName,
                fileSize,
                mimeType,
                filePath,
                received: 0
            };


            socket.emit("upload-started", {
                uploadId
            });


            console.log(
                `Upload started: ${safeName}`
            );

        } catch (error) {

            console.error(error);

            socket.emit("upload-error", {
                message: "حدث خطأ أثناء بداية الرفع"
            });

        }

    });


    // استقبال chunk
    socket.on("upload-chunk", (data) => {

        try {

            const {
                uploadId,
                chunk
            } = data;


            const upload =
                socket.uploads?.[uploadId];


            if (!upload) {

                socket.emit("upload-error", {
                    message: "Upload غير موجود"
                });

                return;
            }


            // تحويل البيانات إلى Buffer
            const buffer = Buffer.from(chunk);


            // إضافة الـ chunk للملف
            fs.appendFileSync(
                upload.filePath,
                buffer
            );


            upload.received +=
                buffer.length;


            const progress =
                Math.round(
                    (upload.received /
                    upload.fileSize) * 100
                );


            socket.emit(
                "upload-progress",
                {
                    uploadId,
                    progress,
                    received: upload.received,
                    total: upload.fileSize
                }
            );


        } catch (error) {

            console.error(error);

            socket.emit("upload-error", {
                message: "حدث خطأ أثناء رفع الملف"
            });

        }

    });


    // انتهاء رفع الملف
    socket.on("upload-end", (data) => {

        const {
            uploadId
        } = data;


        const upload =
            socket.uploads?.[uploadId];


        if (!upload) {
            return;
        }


        console.log(
            `Upload finished: ${upload.fileName}`
        );


        socket.emit(
            "upload-complete",
            {
                uploadId,
                fileName: upload.fileName
            }
        );


        delete socket.uploads[
            uploadId
        ];

    });


    socket.on("disconnect", () => {

        console.log(
            "Client disconnected:",
            socket.id
        );

    });

});


const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});