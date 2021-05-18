import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";
import styled from "styled-components";
import Loader from "react-loader-spinner";

const Container = styled.div`
    height: 100vh;
    width: 50%;
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
`;

const Messages = styled.div`
    width: 100%;
    height: 60%;
    border: 1px solid black;
    margin-top: 10px;
    overflow: scroll;
`;

const MessageBox = styled.textarea`
    width: 100%;
    height: 30%;
`;

const Button = styled.div`
    width: 50%;
    border: 1px solid black;
    margin-top: 15px;
    height: 5%;
    border-radius: 5px;
    cursor: pointer;
    background-color: black;
    color: white;
    font-size: 18px;
`;

const MyRow = styled.div`
  width: 100%;
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
`;

const MyMessage = styled.div`
  width: 45%;
  background-color: blue;
  color: white;
  padding: 10px;
  margin-right: 5px;
  text-align: center;
  border-top-right-radius: 10%;
  border-bottom-right-radius: 10%;
`;

const PartnerRow = styled(MyRow)`
  justify-content: flex-start;
`;

const PartnerMessage = styled.div`
  width: 45%;
  background-color: grey;
  color: white;
  border: 1px solid lightgray;
  padding: 10px;
  margin-left: 5px;
  text-align: center;
  border-top-left-radius: 10%;
  border-bottom-left-radius: 10%;
`;

const Room = (props) => {
    const peerRef = useRef();
    const socketRef = useRef();
    const otherUser = useRef();
    const sendChannel = useRef();
    const [text, setText] = useState("");
    const [messages, setMessages] = useState([]);
    const [token,setToken] = useState(true)
    const [loader,setLoader] = useState(true)
    const [user,setUser] = useState(true)

    useEffect(() => {
        socketRef.current = io.connect("http://localhost:8000");
        socketRef.current.emit("connected", {token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNjIxMTk4MjYyLCJqdGkiOiJiNDgyMjk0N2JiZGU0YzYwOGQxM2U0YzRjZTMwOWVmYyIsInVzZXJfaWQiOjEyMiwicm9sZXMiOnt9fQ.ycXMhUgeEGIQVOcsCBfIMeydOn16EgaM39gCILPi5a8"});

        socketRef.current.on('token', token => {
            console.log("token = " , token)
            console.log("token = " ,typeof(token))
            setToken(true)
            setLoader(false)
            if (token == 'correct'){
                socketRef.current.emit("join_room1");
                socketRef.current.on('no_user', users => {
                    console.log("users = " ,users)
                    if(users.length == 1){
                        setUser(false)
                    }
                });
                socketRef.current.on('other_user', userID => {
                    console.log("other_user = " , userID)
                    callUser(userID);
                    otherUser.current = userID;
                });
        
                socketRef.current.on("user_joined", userID => {
                    console.log("user_joined = " , userID)
                    otherUser.current = userID;
                    setUser(true)
                });
        
                socketRef.current.on("offer", handleOffer);
        
                socketRef.current.on("answer", handleAnswer);
        
                socketRef.current.on("ice_candidate", handleNewICECandidateMsg);
               
               
            }
            if(token == 'incorrect'){
                console.log("your token is not correct")
                setToken(false)
                setLoader(false)
            }
        });

        // socketRef.current.on('other_user', userID => {
        //     console.log("other_user = " , userID)
        //     callUser(userID);
        //     otherUser.current = userID;
        // });

        // socketRef.current.on("user_joined", userID => {
        //     console.log("user_joined = " , userID)
        //     otherUser.current = userID;
        // });

        // socketRef.current.on("offer", handleOffer);

        // socketRef.current.on("answer", handleAnswer);

        // socketRef.current.on("ice_candidate", handleNewICECandidateMsg);

    }, []);


    function callUser(userID) {
        peerRef.current = createPeer(userID);
        sendChannel.current = peerRef.current.createDataChannel("sendChannel");
        sendChannel.current.onmessage = handleReceiveMessage;
    }

    function handleReceiveMessage(e){
        setMessages(messages => [...messages, {yours:false, value: e.data}])
    }

    function createPeer(userID) {
        const peer = new RTCPeerConnection({
            // iceServers: [
            //     {
            //         urls: "stun:stun.stunprotocol.org"
            //     },
            //     {
            //         urls: 'turn:numb.viagenie.ca',
            //         credential: 'muazkh',
            //         username: 'webrtc@live.com'
            //     },
            // ]
        });

        peer.onicecandidate = handleICECandidateEvent;
        peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);

        return peer;
    }

    function handleNegotiationNeededEvent(userID) {
        peerRef.current.createOffer().then(offer => {
            return peerRef.current.setLocalDescription(offer);
        }).then(() => {
            const payload = {
                target: userID,
                caller: socketRef.current.id,
                sdp: peerRef.current.localDescription
            };
            socketRef.current.emit("offer", payload);
        }).catch(e => console.log(e));
    }

    function handleOffer(incoming) {
        peerRef.current = createPeer();
        peerRef.current.ondatachannel = (event) => {
            sendChannel.current = event.channel;
            sendChannel.current.onmessage = handleReceiveMessage
        }
        const desc = new RTCSessionDescription(incoming.sdp);
        peerRef.current.setRemoteDescription(desc).then(() => {
        }).then(() => {
            return peerRef.current.createAnswer();
        }).then(answer => {
            return peerRef.current.setLocalDescription(answer);
        }).then(() => {
            const payload = {
                target: incoming.caller,
                caller: socketRef.current.id,
                sdp: peerRef.current.localDescription
            }
            socketRef.current.emit("answer", payload);
        })
    }

    function handleAnswer(message) {
        const desc = new RTCSessionDescription(message.sdp);
        peerRef.current.setRemoteDescription(desc).catch(e => console.log(e));
    }

    function handleICECandidateEvent(e) {
        if (e.candidate) {
            const payload = {
                target: otherUser.current,
                candidate: e.candidate,
            }
            socketRef.current.emit("ice_candidate", payload);
        }
    }

    function handleNewICECandidateMsg(incoming) {
        const candidate = new RTCIceCandidate(incoming);

        peerRef.current.addIceCandidate(candidate)
            .catch(e => console.log(e));
    }

    function handleChange(e) {
        setText(e.target.value);
    }

    function sendMessage(){
        sendChannel.current.send(text)
        setMessages(messages => [...messages, {yours:true, value: text}])
        setText("")
    }

    function renderMessage(message, index) {
        if (message.yours) {
            return (
                <MyRow key={index}>
                    <MyMessage>
                        {message.value}
                    </MyMessage>
                </MyRow>
            )
        }

        return (
            <PartnerRow key={index}>
                <PartnerMessage>
                    {message.value}
                </PartnerMessage>
            </PartnerRow>
        )
    }

    return (
       <div>
       {loader ==true && (
           <Loader type="Puff" color="#00BFFF" height={100} width={100}/>                        
       )}
        {loader == false && (
            <div>
                {token ==true && (
                    <div>
                        {user == true && (
                            <Container>
                                <Messages>
                                    {messages.map(renderMessage)}
                                </Messages>
                                <MessageBox value={text} onChange={handleChange} placeholder="Say something....." />
                                <Button onClick={sendMessage}>Send..</Button>
                            </Container>
                        )}
                        {user ==false && (
                            <h1>No user is online</h1>
                        )}
                       
                    </div>
                )}
                {token == false && (
                    <h1>Your token is incorrect</h1>
                )}
            </div>
        )}
       
       
        </div>
    );
};

export default Room;